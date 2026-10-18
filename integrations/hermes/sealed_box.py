"""rply's sealed box (packages/schema/src/crypto.ts): ephemeral X25519 + HKDF-SHA256 + XChaCha20-Poly1305."""

import base64
import struct

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

INFO = b"rply-sealed-box-v1"
_RAW = (serialization.Encoding.Raw, serialization.PublicFormat.Raw)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def generate_keypair() -> tuple[str, str]:
    """(secret key, public key), base64url like the CLI's."""
    key = X25519PrivateKey.generate()
    secret = key.private_bytes(serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption())
    return _b64(secret), _b64(key.public_key().public_bytes(*_RAW))


def _hchacha20(key: bytes, nonce: bytes) -> bytes:
    """Derives the XChaCha20 subkey from the first 16 nonce bytes."""
    mask = 0xFFFFFFFF
    s = list(struct.unpack("<4I", b"expand 32-byte k") + struct.unpack("<8I", key) + struct.unpack("<4I", nonce))

    def quarter(a: int, b: int, c: int, d: int) -> None:
        for x, y, z, r in ((a, b, d, 16), (c, d, b, 12), (a, b, d, 8), (c, d, b, 7)):
            s[x] = (s[x] + s[y]) & mask
            s[z] ^= s[x]
            s[z] = ((s[z] << r) | (s[z] >> (32 - r))) & mask

    for _ in range(10):
        quarter(0, 4, 8, 12), quarter(1, 5, 9, 13), quarter(2, 6, 10, 14), quarter(3, 7, 11, 15)
        quarter(0, 5, 10, 15), quarter(1, 6, 11, 12), quarter(2, 7, 8, 13), quarter(3, 4, 9, 14)
    return struct.pack("<8I", *(s[0:4] + s[12:16]))


def open_sealed(sealed: str, secret_key: str) -> str:
    version, _, payload = sealed.partition(".")
    if version != "v1" or not payload:
        raise ValueError("Unsupported sealed format")
    data = _unb64(payload)
    ephemeral, nonce, ciphertext = data[:32], data[32:56], data[56:]
    private = X25519PrivateKey.from_private_bytes(_unb64(secret_key))
    shared = private.exchange(X25519PublicKey.from_public_bytes(ephemeral))
    salt = ephemeral + private.public_key().public_bytes(*_RAW)
    key = HKDF(algorithm=hashes.SHA256(), length=32, salt=salt, info=INFO).derive(shared)
    plaintext = ChaCha20Poly1305(_hchacha20(key, nonce[:16])).decrypt(b"\0" * 4 + nonce[16:], ciphertext, None)
    return plaintext.decode()
