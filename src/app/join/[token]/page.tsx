import Link from "next/link";
import { Button, Card, Notice, PageTitle } from "@/components/ui";
import { loadInvite, maskEmail } from "@/lib/invites";
import { acceptInvite, rejectInvite } from "./actions";

// Opening this page changes nothing. Only the Yes button signs in, so email
// scanners that pre-open links do not use them up.
export default async function JoinPage({ params, searchParams }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const notMe = (await searchParams)["not-me"];
  const invite = await loadInvite(token);

  if (notMe) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <PageTitle>Thanks for telling us</PageTitle>
        <p>We let the association know this link went to the wrong person. Nobody was signed in.</p>
      </div>
    );
  }

  if (!invite || invite.expired) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <PageTitle>This link no longer works</PageTitle>
        <p>It expired, or a newer link was sent. You can still log in with your email.</p>
        <Link className="font-semibold text-red underline" href="/login">Log in with email</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <PageTitle eyebrow="LNGBA Hustle Tracker">Is this you?</PageTitle>
      <Card className="flex flex-col gap-3">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-muted">Name</div>
          <div className="text-xl font-semibold">{invite.name || "No name on file"}</div>
        </div>
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-muted">Email</div>
          <div>{maskEmail(invite.email)}</div>
        </div>
        {invite.players.length > 0 && (
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-muted">Parent of</div>
            <ul className="flex flex-col gap-1">
              {invite.players.map((p) => (
                <li key={p.name + p.team} className="text-lg">
                  <b>{p.name}</b>{p.jersey && <> #{p.jersey}</>} <span className="text-muted">· {p.team}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {invite.coachTeams.length > 0 && (
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-muted">Coach of</div>
            <div className="text-lg">{invite.coachTeams.join(", ")}</div>
          </div>
        )}
      </Card>
      {invite.accepted && <Notice>You already used this link once. Tap Yes to sign in again on this phone.</Notice>}
      <form action={acceptInvite.bind(null, token)}>
        <Button className="w-full text-xl">Yes, that&apos;s me</Button>
      </form>
      <form action={rejectInvite.bind(null, token)} className="text-center">
        <Button variant="ghost">No, this is not me</Button>
      </form>
    </div>
  );
}
