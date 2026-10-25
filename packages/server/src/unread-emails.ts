import type { Deps } from "./context.ts";
import type { EmailSender } from "./email.ts";
import { now } from "./tokens.ts";

// give the apps a chance first, and email each user at most once a day
export const UNREAD_EMAIL_DELAY_MS = 30 * 60 * 1000;
export const UNREAD_EMAIL_GAP_MS = 24 * 60 * 60 * 1000;

// users without push hear about unread agent messages by email instead
export async function emailUnread({ db }: Deps, email: EmailSender, url: string) {
  const t = now();
  const rows = await db
    .selectFrom("channel_members as m")
    .innerJoin("messages as msg", (j) => j.onRef("msg.channel_id", "=", "m.channel_id").onRef("msg.seq", ">", "m.read_seq"))
    .innerJoin("channels as c", "c.id", "m.channel_id")
    .innerJoin("user as u", "u.id", "m.user_id")
    .leftJoin("unread_emails as e", "e.user_id", "m.user_id")
    .where("msg.sender", "=", "agent")
    .where("msg.deleted_at", "is", null)
    .where("msg.created_at", "<=", t - UNREAD_EMAIL_DELAY_MS)
    .where((eb) => eb.or([eb("e.sent_at", "is", null), eb("e.sent_at", "<=", t - UNREAD_EMAIL_GAP_MS)]))
    .where((eb) => eb.not(eb.exists(eb.selectFrom("push_subscriptions as p").select("p.id").whereRef("p.user_id", "=", "m.user_id"))))
    .groupBy(["m.user_id", "u.email", "c.id", "c.name", "e.seq"])
    .select((eb) => ["m.user_id", "u.email", "c.id as channel_id", "c.name", "e.seq as emailed_seq", eb.fn.countAll<number>().as("unread"), eb.fn.max("msg.seq").as("seq")])
    .orderBy("c.name")
    .execute();

  const users = Map.groupBy(rows, (r) => r.user_id);
  let sent = 0;
  for (const [userId, channels] of users) {
    const seq = Math.max(...channels.map((c) => Number(c.seq)));
    if (seq <= Number(channels[0]!.emailed_seq ?? 0)) continue;
    const total = channels.reduce((n, c) => n + Number(c.unread), 0);
    const lines = channels.map((c) => `- ${c.name}: ${c.unread} unread\n  ${new URL(`/c/${c.channel_id}`, url)}`);
    try {
      await email({
        to: channels[0]!.email,
        subject: `You have ${total} unread message${total === 1 ? "" : "s"} in rply`,
        text: `Your agents are waiting on you:\n\n${lines.join("\n")}\n\nTurn on notifications in rply to get these as push notifications instead of emails.`,
      });
    } catch (err) {
      console.error("unread email failed", err);
      continue;
    }
    await db
      .insertInto("unread_emails")
      .values({ user_id: userId, seq, sent_at: t })
      .onConflict((oc) => oc.column("user_id").doUpdateSet({ seq, sent_at: t }))
      .execute();
    sent++;
  }
  return sent;
}
