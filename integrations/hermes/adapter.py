"""rply platform adapter: long-polls an rply channel for the human's messages, posts replies back.

Env: RPLY_TOKEN (agent token, required), RPLY_SERVER (default https://app.rply.sh), RPLY_ALLOWED_USERS
(the channel id, written by setup), RPLY_ALLOW_ALL_USERS, RPLY_HOME_CHANNEL. Only members of the channel
can post to it, so the channel id is the one trusted user.
"""

import asyncio
import json
import logging
import mimetypes
import time
from datetime import datetime, UTC
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False
    httpx = None  # type: ignore[assignment]

from gateway.config import Platform, PlatformConfig
from gateway.platforms.base import (
    BasePlatformAdapter, ExecApprovalPrompt, SendResult,
    cache_audio_from_bytes_async, cache_document_from_bytes_async, cache_image_from_bytes_async,
)
from gateway.platforms.base_exec_approval import approval_timeout_seconds
from gateway.platforms.event import MessageEvent, MessageType, ProcessingOutcome
from gateway.platforms.helpers import MessageDeduplicator
from gateway.platforms._shared import (
    extra_or_secret as _extra_or_secret, get_scoped_secret as _get_scoped_secret,
    seed_extra_from_env as _seed_extra_from_env, send_error,
)
from hermes_constants import get_hermes_home

logger = logging.getLogger(__name__)

DEFAULT_SERVER = "https://app.rply.sh"
POLL_WAIT_SECONDS = 55
RECONNECT_BACKOFF = [2, 5, 10, 30, 60]
INLINE_IMAGES = {"image/png", "image/jpeg", "image/gif", "image/webp"}


class _FatalError(Exception):
    """The token was rejected or the channel is gone."""


def _server_url(extra: dict[str, Any]) -> str:
    return _extra_or_secret(extra, "server", "RPLY_SERVER", DEFAULT_SERVER).rstrip("/")


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token.strip()}"}


def check_requirements() -> bool:
    return HTTPX_AVAILABLE and bool(_get_scoped_secret("RPLY_TOKEN", "").strip())


def validate_config(config) -> bool:
    return bool(_extra_or_secret(getattr(config, "extra", {}) or {}, "token", "RPLY_TOKEN"))


def is_connected(config) -> bool:
    return validate_config(config)


def _message_text(message: dict[str, Any]) -> str:
    """What the human sent, phrased like `rply inbox` prints it."""
    body = message.get("body") or {}
    if event := body.get("event"):
        name = f' "{event["label"]}"' if event.get("label") else ""
        return (f"event{name} from {event.get('block_id') or 'embed'} in message {message.get('reply_to')}: "
                f"{json.dumps(event.get('value'))}")
    if call := body.get("call"):
        return (f'call "{call["name"]}" from {call.get("block_id") or "embed"} in message {message.get("reply_to")}: '
                f"{json.dumps(call.get('args'))}\nAnswer with: rply respond {message['id']} '<json>'")
    return (body.get("text") or "").strip()


def _message_type(media_types: list[str]) -> MessageType:
    if not media_types:
        return MessageType.TEXT
    if all(m.startswith("image/") for m in media_types):
        return MessageType.PHOTO
    if all(m.startswith("audio/") for m in media_types):
        return MessageType.VOICE
    return MessageType.DOCUMENT


def _file_block(ref: dict[str, Any]) -> dict[str, Any]:
    if ref["mime"] in INLINE_IMAGES:
        return {"type": "image", "file_id": ref["file_id"], "name": ref["name"]}
    return {"type": "file", "file_id": ref["file_id"], "name": ref["name"], "mime": ref["mime"], "size": ref["size"]}


async def _upload(client: "httpx.AsyncClient", data: bytes, name: str, mime: Optional[str] = None) -> dict[str, Any]:
    """Uploads go first; messages then reference them by file id."""
    mime = mime or mimetypes.guess_type(name)[0] or "application/octet-stream"
    resp = await client.post("/files", params={"name": name}, content=data, headers={"content-type": mime}, timeout=120.0)
    resp.raise_for_status()
    return resp.json()


class RplyAdapter(BasePlatformAdapter):
    """One rply channel as one DM: inbound by long-polling /v1/messages, outbound by POST."""

    supports_code_blocks = True
    # Hermes' live tool phrase ("running terminal") shows next to "Working on it" under the message
    supports_status_text = True

    def __init__(self, config: PlatformConfig):
        super().__init__(config=config, platform=Platform("rply"))
        extra = config.extra or {}
        self._server = _server_url(extra)
        self._token = _extra_or_secret(extra, "token", "RPLY_TOKEN")
        self._channel: dict[str, Any] = {}
        self._cursor: Optional[int] = None
        self._poll_task: Optional[asyncio.Task] = None
        self._http: Optional[httpx.AsyncClient] = None
        self._dedup = MessageDeduplicator(max_size=1000, ttl_seconds=300)
        # rply message id of an open question -> ("approval", session_key) | ("clarify", clarify_id)
        self._pending: dict[str, tuple[str, str]] = {}
        self._clarify_messages: dict[str, str] = {}
        # chat id -> [rply id of the message being worked on, last note sent]
        self._working: dict[str, list[Optional[str]]] = {}

    # -- Connection lifecycle -----------------------------------------------

    async def connect(self, *, is_reconnect: bool = False) -> bool:
        if not HTTPX_AVAILABLE or not self._token:
            logger.warning("[%s] httpx missing or RPLY_TOKEN not configured", self.name)
            return False
        self._http = httpx.AsyncClient(base_url=f"{self._server}/v1", headers=_headers(self._token), timeout=15.0)
        try:
            resp = await self._http.get("/channel")
            resp.raise_for_status()
            self._channel = resp.json()["channel"]
        except Exception as e:
            logger.error("[%s] Can't reach the rply channel on %s: %s", self.name, self._server, e)
            await self._http.aclose()
            self._http = None
            return False
        self._cursor = await self._initial_cursor()
        self._poll_task = asyncio.create_task(self._run_poll())
        self._mark_connected()
        self._wire_plugin_handlers(None)
        logger.info("[%s] Connected to channel %s on %s", self.name, self._channel.get("name"), self._server)
        return True

    async def disconnect(self) -> None:
        self._running = False
        self._mark_disconnected()
        if self._poll_task:
            self._poll_task.cancel()
            try:
                await self._poll_task
            except asyncio.CancelledError:
                pass
            self._poll_task = None
        if self._http:
            await self._http.aclose()
            self._http = None
        self._dedup.clear()

    # -- Cursor: messages that arrive while the gateway is down are delivered on the next start --

    def _cursor_path(self):
        return get_hermes_home() / "rply" / f"cursor-{self._channel['id']}.json"

    async def _initial_cursor(self) -> int:
        try:
            return int(json.loads(self._cursor_path().read_text())["cursor"])
        except (FileNotFoundError, KeyError, ValueError):
            pass
        resp = await self._http.get("/messages", params={"sender": "human", "peek": "1"})
        resp.raise_for_status()
        cursor = int(resp.json()["cursor"])
        self._save_cursor(cursor)
        return cursor

    def _save_cursor(self, cursor: int) -> None:
        path = self._cursor_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"cursor": cursor}))

    # -- Inbound --------------------------------------------------------------

    async def _run_poll(self) -> None:
        backoff_idx = 0
        while self._running:
            started = time.monotonic()
            try:
                await self._poll_once()
                backoff_idx = 0
                continue
            except asyncio.CancelledError:
                return
            except _FatalError as e:
                self._set_fatal_error("rply_unauthorized", str(e), retryable=False)
                self._running = False
                return
            except Exception as e:
                if not self._running:
                    return
                logger.warning("[%s] Poll error: %s", self.name, e)
            if time.monotonic() - started >= 60:
                backoff_idx = 0
            await asyncio.sleep(RECONNECT_BACKOFF[min(backoff_idx, len(RECONNECT_BACKOFF) - 1)])
            backoff_idx += 1

    async def _poll_once(self) -> None:
        resp = await self._http.get(
            "/messages", params={"sender": "human", "since": self._cursor, "wait": POLL_WAIT_SECONDS},
            timeout=httpx.Timeout(connect=15.0, read=POLL_WAIT_SECONDS + 30, write=15.0, pool=15.0))
        if resp.status_code in (401, 404):
            raise _FatalError(f"rply answered {resp.status_code}: the agent token was revoked or the channel deleted")
        resp.raise_for_status()
        data = resp.json()
        for message in data["messages"]:
            await self._on_message(message)
        self._cursor = int(data["cursor"])
        self._save_cursor(self._cursor)

    async def _on_message(self, message: dict[str, Any]) -> None:
        if self._dedup.is_duplicate(message["id"]):
            return
        if message.get("enc"):
            logger.warning("[%s] Skipping an end-to-end encrypted message (not supported yet)", self.name)
            return
        body = message.get("body") or {}
        if "answers" in body:
            self._resolve_answer(message)
            return
        media_urls, media_types, failed = await self._download_attachments(body.get("attachments") or [])
        text = "\n".join([_message_text(message), *failed]).strip()
        if not text and not media_urls:
            return
        channel_id = self._channel["id"]
        source = self.build_source(
            chat_id=channel_id, chat_name=self._channel.get("name") or "rply", chat_type="dm",
            user_id=channel_id, user_name=self._channel.get("name") or "rply", message_id=message["id"])
        await self.handle_message(MessageEvent(
            text=text, message_type=_message_type(media_types), source=source, message_id=message["id"],
            raw_message=message, media_urls=media_urls, media_types=media_types,
            timestamp=datetime.fromtimestamp(message["created_at"] / 1000, tz=UTC)))

    async def _download_attachments(self, refs: list[dict[str, Any]]) -> tuple[list[str], list[str], list[str]]:
        """Cache the human's attachments locally so Hermes' tools (vision, files) can use them."""
        paths, types, failed = [], [], []
        for ref in refs:
            try:
                resp = await self._http.get(f"/files/{ref['file_id']}", follow_redirects=True, timeout=120.0)
                resp.raise_for_status()
                mime, ext = ref.get("mime") or "application/octet-stream", Path(ref["name"]).suffix
                if mime.startswith("image/"):
                    path = await cache_image_from_bytes_async(resp.content, ext or ".jpg")
                elif mime.startswith("audio/"):
                    path = await cache_audio_from_bytes_async(resp.content, ext or ".ogg")
                else:
                    path = await cache_document_from_bytes_async(resp.content, ref["name"])
                paths.append(path)
                types.append(mime)
            except Exception as e:
                logger.warning("[%s] Couldn't download attachment %s: %s", self.name, ref.get("file_id"), e)
                failed.append(f"(attachment {ref.get('name')} couldn't be downloaded)")
        return paths, types, failed

    def _resolve_answer(self, message: dict[str, Any]) -> None:
        """Answers to our own questions resolve the waiting approval or clarify; others belong to the CLI."""
        pending = self._pending.pop(message.get("reply_to") or "", None)
        if not pending:
            return
        kind, key = pending
        answers = message["body"]["answers"]
        if kind == "approval":
            from tools.approval import resolve_gateway_approval
            resolve_gateway_approval(key, str(answers.get("approval") or "deny"))
        else:
            from tools.clarify_gateway import resolve_gateway_clarify
            value = answers.get("answer")
            resolve_gateway_clarify(key, ", ".join(value) if isinstance(value, list) else str(value or ""))
            self._clarify_messages.pop(key, None)

    # -- Seen / working / done ------------------------------------------------
    # Reading the inbox already marks messages seen.

    async def _set_state(self, message_id: Optional[str], state: str, note: Optional[str] = None) -> None:
        if not message_id or not self._http:
            return
        try:
            await self._http.post(f"/messages/{message_id}/state", json={"state": state, **({"note": note[:200]} if note else {})})
        except Exception as e:
            logger.debug("[%s] Couldn't mark %s as %s: %s", self.name, message_id, state, e)

    async def on_processing_start(self, event: MessageEvent) -> None:
        self._working[event.source.chat_id] = [event.message_id, None]
        await self._set_state(event.message_id, "working")

    async def on_processing_complete(self, event: MessageEvent, outcome: ProcessingOutcome) -> None:
        self._working.pop(event.source.chat_id, None)
        if outcome == ProcessingOutcome.SUCCESS:
            await self._set_state(event.message_id, "done")

    async def send_typing(self, chat_id: str, metadata=None) -> None:
        """Called every few seconds during a run; sends the live tool phrase when it changes."""
        entry = self._working.get(chat_id)
        if not entry:
            return
        note = getattr(self, "_status_text", {}).get(str(chat_id))
        if note != entry[1]:
            entry[1] = note
            await self._set_state(entry[0], "working", note)

    # -- Outbound -------------------------------------------------------------

    async def _post(self, body: dict[str, Any], ask: Optional[dict[str, Any]] = None) -> SendResult:
        if not self._http:
            return SendResult(success=False, error="Not connected")
        try:
            resp = await self._http.post("/messages", json={"body": body, **({"ask": ask} if ask else {})})
        except httpx.TimeoutException:
            return SendResult(success=False, error="Timeout posting to rply", retryable=True)
        except Exception as e:
            return SendResult(success=False, error=str(e), retryable=True)
        if resp.status_code >= 300:
            return SendResult(success=False, error=f"HTTP {resp.status_code}: {resp.text[:200]}",
                              retryable=resp.status_code >= 500)
        return SendResult(success=True, message_id=resp.json()["message"]["id"])

    async def send(self, chat_id: str, content: str, reply_to: Optional[str] = None,
                   metadata: Optional[dict[str, Any]] = None) -> SendResult:
        return await self._post({"text": content})

    async def _send_file(self, data: bytes, name: str, caption: Optional[str], mime: Optional[str] = None) -> SendResult:
        if not self._http:
            return SendResult(success=False, error="Not connected")
        try:
            ref = await _upload(self._http, data, name, mime)
        except Exception as e:
            detail = getattr(getattr(e, "response", None), "text", "") or str(e)
            return SendResult(success=False, error=f"rply upload failed: {detail[:200]}")
        return await self._post({"blocks": [_file_block(ref)], **({"text": caption} if caption else {})})

    async def _send_local_file(self, path: str, caption: Optional[str], file_name: Optional[str] = None) -> SendResult:
        try:
            data = await asyncio.to_thread(Path(path).read_bytes)
        except OSError as e:
            return SendResult(success=False, error=str(e))
        return await self._send_file(data, file_name or Path(path).name, caption)

    async def send_image_file(self, chat_id: str, image_path: str, caption: Optional[str] = None,
                              reply_to: Optional[str] = None, metadata: Optional[dict[str, Any]] = None, **kwargs) -> SendResult:
        return await self._send_local_file(image_path, caption)

    async def send_document(self, chat_id: str, file_path: str, caption: Optional[str] = None,
                            file_name: Optional[str] = None, reply_to: Optional[str] = None,
                            metadata: Optional[dict[str, Any]] = None, **kwargs) -> SendResult:
        return await self._send_local_file(file_path, caption, file_name)

    async def send_video(self, chat_id: str, video_path: str, caption: Optional[str] = None,
                         reply_to: Optional[str] = None, metadata: Optional[dict[str, Any]] = None, **kwargs) -> SendResult:
        return await self._send_local_file(video_path, caption)

    async def send_voice(self, chat_id: str, audio_path: str, caption: Optional[str] = None,
                         reply_to: Optional[str] = None, metadata: Optional[dict[str, Any]] = None, **kwargs) -> SendResult:
        return await self._send_local_file(audio_path, caption)

    async def send_image(self, chat_id: str, image_url: str, caption: Optional[str] = None,
                         reply_to: Optional[str] = None, metadata: Optional[dict[str, Any]] = None) -> SendResult:
        """Images by URL are fetched and uploaded, since rply apps load files from the rply server."""
        from tools.url_safety import is_safe_url
        try:
            if not is_safe_url(image_url):
                raise ValueError("refusing a private or local address")
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(image_url)
                resp.raise_for_status()
            mime = resp.headers.get("content-type", "").split(";")[0] or None
            result = await self._send_file(resp.content, Path(urlparse(image_url).path).name or "image", caption, mime)
            if result.success:
                return result
        except Exception as e:
            logger.debug("[%s] Sending %s as a link instead: %s", self.name, image_url, e)
        return await self.send(chat_id, f"{caption or ''}\n{image_url}".strip())

    async def get_chat_info(self, chat_id: str) -> dict[str, Any]:
        return {"name": self._channel.get("name") or "rply", "type": "dm", "chat_id": chat_id}

    async def _send_exec_approval_prompt(self, prompt: ExecApprovalPrompt) -> SendResult:
        options = [{"label": label, "value": choice, **({"danger": True} if style == "danger" else {})}
                   for label, choice, style in prompt.actions]
        expires_at = int(time.time() * 1000) + approval_timeout_seconds() * 1000
        result = await self._post(
            {"text": prompt.text, "blocks": [{"type": "choice", "id": "approval", "options": options}]},
            ask={"expires_at": expires_at})
        if result.success:
            self._pending[result.message_id] = ("approval", prompt.session_key)
        return result

    async def send_clarify(self, chat_id: str, question: str, choices: Optional[list], clarify_id: str,
                           session_key: str, metadata: Optional[dict[str, Any]] = None) -> SendResult:
        if choices:
            block = {"type": "choice", "id": "answer", "options": [{"label": str(c)} for c in choices], "other": True}
        else:
            block = {"type": "text_input", "id": "answer", "multiline": True}
        # Hermes appends a text-reply hint ('Reply "skip" to skip...') that doesn't fit next to a form
        question = "\n".join(line for line in question.splitlines() if '"skip"' not in line).strip()
        result = await self._post({"text": question, "blocks": [block]})
        if result.success:
            self._pending[result.message_id] = ("clarify", clarify_id)
            self._clarify_messages[clarify_id] = result.message_id
        return result

    async def retire_clarify_card(self, clarify_id: str, notice: Optional[str] = None) -> None:
        """The clarify ended without an answer here (timeout, reset): withdraw the question."""
        message_id = self._clarify_messages.pop(clarify_id, None)
        if message_id and self._http:
            self._pending.pop(message_id, None)
            try:
                await self._http.post(f"/messages/{message_id}/cancel")
            except Exception as e:
                logger.debug("[%s] Couldn't cancel question %s: %s", self.name, message_id, e)


# -- Plugin registration ------------------------------------------------------


def _env_enablement() -> dict | None:
    token = _get_scoped_secret("RPLY_TOKEN", "").strip()
    if not token:
        return None
    seed = _seed_extra_from_env((("RPLY_SERVER", "server", lambda v: v.rstrip("/")),),
                                home_env="RPLY_HOME_CHANNEL", home_default="rply")
    return {"token": token, "server": seed.pop("server", DEFAULT_SERVER), **seed}


async def _standalone_send(pconfig, chat_id: str, message: str, *, thread_id: Optional[str] = None,
                           media_files: Optional[list[str]] = None, force_document: bool = False) -> dict[str, Any]:
    """Out-of-process send for cron when no gateway is running. The token decides the channel."""
    if not HTTPX_AVAILABLE:
        return send_error("rply standalone send: httpx not installed")
    extra = getattr(pconfig, "extra", {}) or {}
    token = _extra_or_secret(extra, "token", "RPLY_TOKEN")
    if not token:
        return send_error("rply standalone send: RPLY_TOKEN not configured")
    try:
        async with httpx.AsyncClient(base_url=f"{_server_url(extra)}/v1", headers=_headers(token), timeout=15.0) as client:
            blocks = []
            for path in media_files or []:
                blocks.append(_file_block(await _upload(client, Path(path).read_bytes(), Path(path).name)))
            body = {**({"text": message} if message else {}), **({"blocks": blocks} if blocks else {})}
            resp = await client.post("/messages", json={"body": body})
        if resp.status_code >= 300:
            return send_error(f"rply HTTP {resp.status_code}: {resp.text[:200]}")
        return {"success": True, "platform": "rply", "chat_id": chat_id, "message_id": resp.json()["message"]["id"]}
    except Exception as e:
        return send_error(f"rply standalone send failed: {e}")


def interactive_setup() -> None:
    """`hermes gateway setup`: join a channel made in the app, or create one and claim it there."""
    from hermes_cli.setup import prompt, save_env_value, get_env_value, print_header, print_info, print_success, print_warning
    from hermes_cli.setup_platforms import declines_reconfigure

    print_header("rply")
    if declines_reconfigure("rply", "Reconfigure rply?", "RPLY_TOKEN"):
        return
    print_info("Talk to Hermes from the rply inbox (web app and phone).")
    server = (prompt("rply server", default=get_env_value("RPLY_SERVER") or DEFAULT_SERVER) or DEFAULT_SERVER).rstrip("/")
    print_info("To use a channel you made in the app, open it and choose Add an agent to get a code.")
    code = (prompt("Agent code (leave empty to create a new channel)") or "").strip()
    try:
        with httpx.Client(base_url=f"{server}/v1", timeout=15.0) as client:
            if code:
                resp = client.post("/agents/join", json={"code": code, "label": "Hermes"})
            else:
                name = prompt("Channel name", default="Hermes") or "Hermes"
                resp = client.post("/channels", json={"name": name, "label": "Hermes"})
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        detail = getattr(getattr(e, "response", None), "text", "") or str(e)
        print_warning(f"rply setup failed: {detail[:200]}")
        return
    save_env_value("RPLY_SERVER", server)
    save_env_value("RPLY_TOKEN", data["agent_token"])
    save_env_value("RPLY_ALLOWED_USERS", data["channel"]["id"])
    if claim := data.get("claim"):
        minutes = max(1, round((claim["expires_at"] / 1000 - time.time()) / 60))
        print_info(f"Open this link within {minutes} minutes to add the channel to your rply account:")
        print_info(f"   {server}/claim?c={claim['code']}")
    print_success(f"Connected to rply channel \"{data['channel']['name']}\"")
    print_info("Restart the gateway for changes to take effect: hermes gateway restart")


def register(ctx) -> None:
    ctx.register_platform(
        name="rply", label="rply", adapter_factory=lambda cfg: RplyAdapter(cfg),
        check_fn=check_requirements, validate_config=validate_config, is_connected=is_connected,
        required_env=["RPLY_TOKEN"], install_hint="pip install httpx   # already a Hermes dependency",
        setup_fn=interactive_setup, env_enablement_fn=_env_enablement,
        cron_deliver_env_var="RPLY_HOME_CHANNEL", standalone_sender_fn=_standalone_send,
        allowed_users_env="RPLY_ALLOWED_USERS", allow_all_env="RPLY_ALLOW_ALL_USERS",
        emoji="🐦", pii_safe=True, allow_update_command=True,
        platform_hint=(
            "You are talking to your human through rply, an inbox on their phone and laptop. "
            "Your replies already go to rply and render as markdown, and their messages reach you directly: "
            "don't use `rply send`, `rply inbox` or `rply ack` for this conversation. Send images and files "
            "the normal way; they show up in the inbox with previews. Keep messages short and readable on a "
            "phone. If the rply CLI is installed, use it only for pinned status, apps and secret requests "
            "(`rply guide` explains them)."
        ))
