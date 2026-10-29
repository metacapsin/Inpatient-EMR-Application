# ICD-10-CM order files

Place the official CMS/NCHS **Code Descriptions in Tabular Order** extract here:

- Expected file name: `icd10cm-order-YYYY.txt` (e.g. `icd10cm-order-2026.txt`)
- Download (FY2026): https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/2026/icd10cm-Code%20Descriptions-2026.zip

Then import:

```bash
npm run db:seed:icd10
# or:
ICD10_AUTO_DOWNLOAD=1 npm run db:seed:icd10
ICD10_ORDER_FILE=/path/to/icd10cm-order-2026.txt ICD10_EFFECTIVE_YEAR=2026 npm run db:seed:icd10
```

Large zip/txt files under this folder are gitignored. The import fails if fewer than 70,000 rows are parsed unless `ICD10_ALLOW_PARTIAL=1` is set explicitly.
