import { setSurveyActiveAction } from "@/lib/surveys/actions"
import { Button } from "@/components/ui/button"

export default function ToggleActiveButton({ id, active }: { id: string; active: boolean }) {
  return (
    <form action={setSurveyActiveAction.bind(null, id, !active)}>
      <Button type="submit" variant={active ? "ghost" : "outline"} size="lg" className={active ? "text-destructive" : undefined}>
        {active ? "Deactivate" : "Reactivate"}
      </Button>
    </form>
  )
}
