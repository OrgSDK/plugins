/**
 * Human-readable formatting for canonical manifest parse errors.
 *
 * Extracted from the manifest module so the schema definition stays under the
 * file-size budget. Reserved runtime-enriched fields are reported with a
 * targeted message; everything else uses a field-path prefix.
 */

import type { z } from "zod";
import { RESERVED_RUNTIME_FIELDS } from "./manifest";

/**
 * Turn a {@link z.ZodError} into a multi-line, human-readable string. Each
 * issue becomes one line. Unrecognized reserved fields get a specific message;
 * other unknown keys get a generic removal hint.
 */
export function formatManifestError(error: z.ZodError): string {
	const reserved = RESERVED_RUNTIME_FIELDS as readonly string[];
	const lines: string[] = [];
	for (const issue of error.issues) {
		if (issue.code === "unrecognized_keys") {
			for (const key of (issue as { keys: string[] }).keys) {
				if (reserved.includes(key)) {
					lines.push(
						`(root): "${key}" is a runtime-enriched field set by the catalog — remove it from your manifest`,
					);
				} else {
					lines.push(
						`(root): unknown field "${key}" — remove it or move it under a documented extension`,
					);
				}
			}
			continue;
		}
		const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
		lines.push(`${path}: ${issue.message}`);
	}
	return lines.join("\n");
}
