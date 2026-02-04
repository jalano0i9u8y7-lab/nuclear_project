# Docs Implementation & Governance

## 1. Authority Hierarchy
1. **SSOT (Single Source of Truth)**: `V8.0架構定案文檔_SSOT.md` is the ultimate authority.
2. **Docs Registry**: `docs/registry.yaml` lists all other valid documents.
3. **Source Code**: Implementation details.

## 2. AI Read-Scope Rule
**Agents MUST NOT infer requirements from legacy files.**
Refer only to documents listed in `docs/registry.yaml`.
- **Allowed**: `src/nuclear`, `tests`, `docs/registry.yaml`, `SSOT`
- **Forbidden**: `gas_archive/` (unless explicitly task-authorized)

## 3. How to Add a New Document
1. **Create File**: Place the markdown file in `docs/`.
2. **Register**: Add an entry to `referenced_docs` in `docs/registry.yaml`.
   ```yaml
   - id: "MY_DOC"
     title: "My New Spec"
     path: "docs/my_spec.md"
     status: "present"
   ```
3. **Log**: Append a line to `change_log`.

## 4. Maintenance
- Run `python -m nuclear.cli docs status` to check for missing documents.
- Keep `status` updated (`present`, `missing`, `deprecated`).
