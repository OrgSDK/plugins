/**
 * Author-owned structured OAuth setup-guide schema (e.g. Google BYO OAuth).
 *
 * Declared in the plugin manifest under `auth.setupGuide` and projected
 * verbatim through the auth-plugin descriptor so the dashboard renders an
 * in-product checklist instead of sending users to external docs. Structured
 * plain text + validated HTTPS links only — arbitrary HTML is not
 * representable. Strict at every level so a guide cannot carry unmodelled
 * (and unvalidated) content.
 *
 * See docs/product/ux/google-byo-oauth-setup-guide.md §"Plugin contract
 * requirement".
 */

import { z } from "zod";

const HTTPS_URL = /^https:\/\//i;

export const setupGuideLinkSchema = z
	.object({
		label: z.string().min(1).describe("Human-readable link label."),
		url: z
			.string()
			.min(1)
			.regex(HTTPS_URL, "must be an https:// URL")
			.describe("HTTPS link URL (http rejected)."),
	})
	.strict()
	.describe("External link in a setup-guide step.");

export const setupGuideStepSchema = z
	.object({
		title: z.string().min(1).describe("Step title."),
		description: z.string().min(1).describe("Step body / instruction."),
		link: setupGuideLinkSchema.optional().describe("Optional contextual link."),
	})
	.strict()
	.describe("A single numbered step in the setup guide.");

export const setupGuidePermissionSchema = z
	.object({
		label: z.string().min(1).describe("Human-readable outcome for the scope."),
		classification: z
			.string()
			.min(1)
			.optional()
			.describe('Optional classification (e.g. "Restricted / broad").'),
	})
	.strict()
	.describe("Author-owned presentation for one OAuth scope.");

/**
 * Canonical Zod schema for an OAuth setup guide. `.strict()` rejects unknown
 * fields so a guide cannot carry unmodelled (and unvalidated) content.
 */
export const setupGuideSchema = z
	.object({
		summary: z
			.string()
			.min(1)
			.describe("Plain-language summary of the connection process."),
		prerequisites: z
			.array(z.string().min(1))
			.optional()
			.describe("Prerequisite bullets shown before the steps."),
		steps: z
			.array(setupGuideStepSchema)
			.min(1)
			.describe("Ordered, non-empty setup steps."),
		callback: z
			.object({
				label: z.string().min(1).describe("Callback URL label."),
				instruction: z
					.string()
					.min(1)
					.describe("Where to paste the callback URL."),
			})
			.strict()
			.optional()
			.describe("Presentation for the server-resolved callback URL."),
		configField: z
			.object({
				label: z.string().min(1).describe("Credential field label."),
				description: z.string().min(1).describe("Credential field help text."),
				placeholder: z
					.string()
					.optional()
					.describe("Credential field placeholder."),
			})
			.strict()
			.describe("Presentation for the credential JSON field."),
		permissions: z
			.record(z.string(), setupGuidePermissionSchema)
			.optional()
			.describe("Scope presentation keyed by the exact OAuth scope value."),
		troubleshootingUrl: z
			.string()
			.min(1)
			.regex(HTTPS_URL, "must be an https:// URL")
			.optional()
			.describe("HTTPS troubleshooting documentation URL."),
	})
	.strict()
	.describe("Author-owned structured OAuth setup guide.");

export type OAuthSetupGuideLink = z.infer<typeof setupGuideLinkSchema>;
export type OAuthSetupGuideStep = z.infer<typeof setupGuideStepSchema>;
export type OAuthSetupGuidePermission = z.infer<
	typeof setupGuidePermissionSchema
>;
export type OAuthSetupGuide = z.infer<typeof setupGuideSchema>;
