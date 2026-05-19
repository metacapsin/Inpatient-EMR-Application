/** Common inpatient imaging procedures for quick CPOE (maps to modality + body region). */
export type QuickImagingProcedure = {
    id: string;
    label: string;
    modality: string;
    bodyRegion: string;
    contrast?: string;
    keywords?: string;
};

export const QUICK_IMAGING_PROCEDURES: QuickImagingProcedure[] = [
    {
        id: 'xr-chest-2v',
        label: 'Chest X-Ray — 2 views',
        modality: 'X-Ray',
        bodyRegion: 'Chest',
        keywords: 'cxr portable pa lateral',
    },
    {
        id: 'xr-chest-1v',
        label: 'Chest X-Ray — single view',
        modality: 'X-Ray',
        bodyRegion: 'Chest',
        keywords: 'cxr portable',
    },
    {
        id: 'ct-head-wo',
        label: 'CT Head — without contrast',
        modality: 'CT',
        bodyRegion: 'Head',
        contrast: 'Without contrast',
        keywords: 'head brain stroke',
    },
    {
        id: 'ct-head-w',
        label: 'CT Head — with contrast',
        modality: 'CT',
        bodyRegion: 'Head',
        contrast: 'With contrast',
    },
    {
        id: 'ct-chest-wo',
        label: 'CT Chest — without contrast',
        modality: 'CT',
        bodyRegion: 'Chest',
        contrast: 'Without contrast',
        keywords: 'pe pulmonary embolism',
    },
    {
        id: 'ct-abd-pelvis',
        label: 'CT Abdomen & Pelvis — with contrast',
        modality: 'CT',
        bodyRegion: 'Abdomen',
        contrast: 'With contrast',
        keywords: 'appendicitis abdominal pain',
    },
    {
        id: 'mri-brain',
        label: 'MRI Brain — without contrast',
        modality: 'MRI',
        bodyRegion: 'Brain',
        contrast: 'Without contrast',
    },
    {
        id: 'us-abd',
        label: 'Ultrasound Abdomen — complete',
        modality: 'Ultrasound',
        bodyRegion: 'Abdomen',
    },
    {
        id: 'us-pelvis',
        label: 'Ultrasound Pelvis',
        modality: 'Ultrasound',
        bodyRegion: 'Pelvis',
    },
    {
        id: 'xr-knee',
        label: 'X-Ray Knee — 3 views',
        modality: 'X-Ray',
        bodyRegion: 'Extremity',
        keywords: 'knee fracture',
    },
    {
        id: 'xr-spine-lumbar',
        label: 'X-Ray Lumbar Spine',
        modality: 'X-Ray',
        bodyRegion: 'Spine',
        keywords: 'l-spine back pain',
    },
];

export function findQuickImagingProcedure(id: string): QuickImagingProcedure | undefined {
    return QUICK_IMAGING_PROCEDURES.find((p) => p.id === id);
}
