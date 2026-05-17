-- Script de configuración de seguridad (Supabase RLS)
-- Implementa el principio de mínimo privilegio

-- 1. Habilitar RLS en la tabla de productos
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- 2. Política de lectura: Cualquier usuario (incluso no autenticado) puede ver productos activos
CREATE POLICY "Public products are viewable by everyone" 
ON products FOR SELECT 
USING (is_active = true);

-- 3. Política de gestión: Solo usuarios autenticados (admin) pueden realizar CRUD
CREATE POLICY "Authenticated users can manage products" 
ON products FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 4. Habilitar RLS en Storage (Bucket de productos)
-- Nota: Esto se suele hacer desde el dashboard de Supabase, pero aquí están las políticas lógicas:

-- Permitir lectura pública a objetos en el bucket 'products'
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'products' );

-- Permitir subida/edición solo a autenticados
-- CREATE POLICY "Admin Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'products' );
