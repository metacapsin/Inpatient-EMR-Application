// @ts-check
/**
 * Build a FHIR R4 searchset Bundle.
 * @param {fhir4.FhirResource[]} resources
 * @param {{ total?: number, selfUrl?: string }} [opts]
 * @returns {fhir4.Bundle}
 */
export function searchsetBundle(resources, opts = {}) {
    /** @type {fhir4.Bundle} */
    const bundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: opts.total ?? resources.length,
        entry: resources.map((resource) => ({
            fullUrl: resource.id && 'resourceType' in resource ? `${resource.resourceType}/${resource.id}` : undefined,
            resource,
            search: { mode: 'match' },
        })),
    };
    if (opts.selfUrl) {
        bundle.link = [{ relation: 'self', url: opts.selfUrl }];
    }
    return bundle;
}
