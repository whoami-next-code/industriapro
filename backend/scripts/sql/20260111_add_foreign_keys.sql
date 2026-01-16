-- Script de aplicación de Claves Foráneas (Foreign Keys)
-- Ejecutado el: 2026-01-11
-- Estrategia: NOT VALID (No bloqueante, ignora datos históricos inconsistentes)

BEGIN;

-- 1. Relación Users <-> Orders
-- orders."userId" -> users.id
ALTER TABLE "orders" 
    ADD CONSTRAINT "fk_orders_users" 
    FOREIGN KEY ("userId") 
    REFERENCES "users"("id") 
    ON DELETE SET NULL 
    NOT VALID;

-- 2. Relación Users <-> Audit Logs
-- audit_logs."userId" -> users.id
ALTER TABLE "audit_logs" 
    ADD CONSTRAINT "fk_audit_logs_users" 
    FOREIGN KEY ("userId") 
    REFERENCES "users"("id") 
    ON DELETE SET NULL 
    NOT VALID;

-- 3. Relación Products <-> Contactos
-- contactos."productoId" -> products.id
ALTER TABLE "contactos" 
    ADD CONSTRAINT "fk_contactos_products" 
    FOREIGN KEY ("productoId") 
    REFERENCES "products"("id") 
    ON DELETE SET NULL 
    NOT VALID;

-- NOTA: La tabla 'quotes' no tiene la columna 'orderId' en la base de datos actual,
-- por lo que no se pudo crear la relación fk_quotes_orders.
-- Se recomienda sincronizar el esquema (TypeORM synchronize) o crear la columna manualmente.

COMMIT;
