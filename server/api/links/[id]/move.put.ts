// Move a link to a different folder
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

  const linkId = getRouterParam(event, "id");
  const body = await readBody(event);
  const { folder_id } = body;

  if (!linkId) {
    throw createError({
      statusCode: 400,
      message: "Link ID is required",
    });
  }

  const userId = user.sub || user.id;

  // If folder_id is provided, verify it exists and belongs to user
  if (folder_id !== null && folder_id !== undefined) {
    const { data: folder, error: folderError } = await supabase
      .from("folders")
      .select("id")
      .eq("id", folder_id)
      .eq("user_id", userId)
      .single();

    if (folderError || !folder) {
      throw createError({
        statusCode: 404,
        message: "Folder not found",
      });
    }
  }

  // Update the link's folder_id
  const { data, error } = await supabase
    .from("links")
    .update({ folder_id: folder_id || null })
    .eq("id", linkId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw createError({
      statusCode: 500,
      message: error.message,
    });
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      message: "Link not found",
    });
  }

  return data;
});
