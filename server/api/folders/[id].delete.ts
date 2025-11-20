// Delete a folder
import { serverSupabaseUser } from "#supabase/server";
import { serverSupabaseClient } from "#supabase/server";

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event);
  const user = await serverSupabaseUser(event);

  if (!user) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  const folderId = getRouterParam(event, "id");

  if (!folderId) {
    throw createError({
      statusCode: 400,
      message: "Folder ID is required",
    });
  }

  const userId = user.sub || user.id;

  // First, check if folder exists and belongs to user
  const { data: folder, error: fetchError } = await supabase
    .from("folders")
    .select("id")
    .eq("id", folderId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !folder) {
    throw createError({
      statusCode: 404,
      message: "Folder not found",
    });
  }

  // Delete the folder (links will be set to NULL due to ON DELETE SET NULL)
  const { error } = await supabase
    .from("folders")
    .delete()
    .eq("id", folderId)
    .eq("user_id", userId);

  if (error) {
    throw createError({
      statusCode: 500,
      message: error.message,
    });
  }

  return { success: true };
});
