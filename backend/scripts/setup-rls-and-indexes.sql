-- Índices clave
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users("createdAt");
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products("createdAt");

-- Habilitar RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Políticas: cada usuario ve/modifica su propio perfil
DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users
  FOR SELECT
  TO authenticated
  USING ("supabaseUid" = auth.uid());

DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  TO authenticated
  USING ("supabaseUid" = auth.uid())
  WITH CHECK ("supabaseUid" = auth.uid());
