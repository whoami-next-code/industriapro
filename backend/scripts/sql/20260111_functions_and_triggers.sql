-- Function to auto-approve images uploaded by admins
CREATE OR REPLACE FUNCTION public.handle_new_image_upload()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the user uploading is an admin (based on metadata or a join, but simpler: trust the insert for now or check auth.uid)
  -- Since the insert usually happens via the Service (which uses a service role or authenticated user), 
  -- and we pass 'isApproved' from the service, this might be redundant but ensures integrity.
  
  -- Example logic: If the inserter is an admin in the 'users' table, auto-approve.
  IF EXISTS (
    SELECT 1 FROM public.users 
    WHERE "supabaseUid" = auth.uid() 
    AND role = 'ADMIN'
  ) THEN
    NEW.is_approved := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run the function before insert
DROP TRIGGER IF EXISTS on_image_upload ON public.quotation_images;
CREATE TRIGGER on_image_upload
BEFORE INSERT ON public.quotation_images
FOR EACH ROW EXECUTE FUNCTION public.handle_new_image_upload();

-- Webhook configuration (conceptual, requires pg_net extension and valid URL)
-- This would notify an external system or the backend when a new image is uploaded.
/*
CREATE EXTENSION IF NOT EXISTS "pg_net";

CREATE OR REPLACE FUNCTION public.notify_image_webhook()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://api.example.com/webhooks/new-image',
    body := json_build_object(
      'id', NEW.id,
      'url', NEW.image_url,
      'quotation_id', NEW.quotation_id,
      'uploaded_by', NEW.user_id
    )::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER send_image_webhook
AFTER INSERT ON public.quotation_images
FOR EACH ROW EXECUTE FUNCTION public.notify_image_webhook();
*/
