import { insert, nowIso } from "../db.js";

export function audit(user, entity, entityId, action, detail = null) {
  insert(
    "INSERT INTO audit_log (entity, entity_id, action, actor_id, actor_nama, pada, detail) VALUES (?,?,?,?,?,?,?)",
    entity,
    entityId ?? null,
    action,
    user?.id ?? null,
    user?.nama ?? "Sistem",
    nowIso(),
    detail ? JSON.stringify(detail) : null,
  );
}
