'use client';

import { useSession } from "next-auth/react";
import { notFound } from "next/navigation";

export default function Page() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div>Loading control panel...</div>;
  }

  if (status === "unauthenticated" || !session) {
    notFound();
    return null;
  }

  return (
    <div>
      <h2 className="text-3xl font-bold">Control Panel</h2>
      <p className="mt-4">
        Welcome to the control panel, {session.user.name}!
      </p>
    </div>
  );
}