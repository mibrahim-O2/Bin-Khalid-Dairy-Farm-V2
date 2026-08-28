import { Card, CardContent } from "@/components/ui/card";

export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-bold text-foreground">{title}</h1>
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          This module is built in {phase} of the project roadmap.
        </CardContent>
      </Card>
    </div>
  );
}
