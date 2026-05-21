import { RuleBuilder } from "../_components/RuleBuilder";

export default function NewRulePage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Create New Rule</h1>
        <p className="text-muted-foreground">
          Build engagement automation rules with visual condition and action
          builders
        </p>
      </div>
      <RuleBuilder />
    </div>
  );
}
