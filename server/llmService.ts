import type { Opportunity } from "@shared/schema";
import { BUDGET_LABELS } from "@shared/schema";

function formatSignType(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function generateRationale(params: {
  opportunity: Opportunity;
  tier: string;
  selectedProducts: string[];
  signTypeLabel?: string;
}): string {
  const { opportunity, tier, selectedProducts, signTypeLabel } = params;
  const signLabel = signTypeLabel || formatSignType(opportunity.signType);
  const budgetLabel = BUDGET_LABELS[opportunity.budgetRange] ?? opportunity.budgetRange;

  const tierDescriptions: Record<string, string> = {
    GOOD: "cost-effective solution that meets basic visibility and compliance requirements",
    BETTER: "enhanced solution with improved materials and visibility features",
    BEST: "premium solution with top-tier materials, maximum impact, and extended durability",
  };

  const desc = tierDescriptions[tier] || tierDescriptions.GOOD;
  const productsStr =
    selectedProducts.length > 0 ? selectedProducts.join(", ") : "standard products";

  return (
    `For ${opportunity.clientName}, we recommend the ${tier} tier as a ${desc}. ` +
    `This ${signLabel} solution includes ${productsStr}, ` +
    `designed for ${opportunity.locationType.toLowerCase()} installation at ${opportunity.address}. ` +
    `Within the ${budgetLabel} budget range, this tier provides the best value ` +
    `for the intended ${opportunity.targetAudience.toLowerCase()} audience ` +
    `${opportunity.readDistanceFt ? `with readability at ${opportunity.readDistanceFt} feet` : ""}. ` +
    `The ${opportunity.signDuration.toLowerCase()} installation uses ` +
    `industry-standard mounting appropriate for the specified location type.`
  );
}

export function generateComplianceText(params: {
  opportunity: Opportunity;
  signCodeText?: string | null;
}): string {
  const { opportunity, signCodeText } = params;

  if (signCodeText) {
    return signCodeText;
  }

  const checks = [
    `Location type: ${opportunity.locationType}`,
    `Sign duration: ${opportunity.signDuration}`,
    opportunity.locationType === "EXTERIOR"
      ? "Exterior permit requirements may apply - verify with local jurisdiction"
      : "Interior installation - standard building codes apply",
    "ADA compliance review recommended for public-facing installations",
    "Electrical permit required for illuminated signs",
    `Site address: ${opportunity.address} - physical survey required before fabrication`,
  ];

  return checks.join("\n");
}
