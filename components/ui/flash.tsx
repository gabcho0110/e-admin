import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Alert } from "@/components/ui/primitives";

export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (err) {
    return (
      <Alert tone="danger" title="Действието не е изпълнено" icon={AlertTriangle} className="mb-5">
        {err}
      </Alert>
    );
  }
  if (ok) {
    return (
      <Alert tone="success" icon={CheckCircle2} className="mb-5">
        {ok === "1" ? "Промяната е записана." : ok}
      </Alert>
    );
  }
  return null;
}
