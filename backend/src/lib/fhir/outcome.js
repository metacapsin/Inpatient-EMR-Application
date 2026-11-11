// @ts-check
/**
 * Build a FHIR R4 OperationOutcome.
 * @param {number} status HTTP status used to pick severity/code defaults
 * @param {string} diagnostics
 * @param {string} [code] IssueType code
 * @returns {fhir4.OperationOutcome}
 */
export function operationOutcome(status, diagnostics, code) {
    const issueCode =
        code ||
        (status === 404
            ? 'not-found'
            : status === 401 || status === 403
              ? 'security'
              : status === 400
                ? 'invalid'
                : 'processing');
    return {
        resourceType: 'OperationOutcome',
        issue: [
            {
                severity: status >= 500 ? 'error' : status >= 400 ? 'error' : 'information',
                code: /** @type {fhir4.OperationOutcomeIssue['code']} */ (issueCode),
                diagnostics,
            },
        ],
    };
}
