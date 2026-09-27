import { Card, Notice, PageTitle } from "@/components/ui";
import { LoginForm } from "./LoginForm";

const ERRORS: Record<string, string> = {
  "link-expired": "That login link expired or was already used. Enter your email for a new one.",
  "not-on-roster": "Your email is not on a team roster yet. Ask your team's coach or the association to add you.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <PageTitle eyebrow="Lakeville North Girls Basketball">Log in</PageTitle>
      <p>No password needed. We email you a link and a code.</p>
      {message && <Notice kind="warn">{message}</Notice>}
      <Card><LoginForm /></Card>
    </div>
  );
}
