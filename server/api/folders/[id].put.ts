// Update a folder
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
  const body = await readBody(event);
  const { name, color, icon } = body;

  if (!folderId) {
    throw createError({
      statusCode: 400,
      message: "Folder ID is required",
    });
  }

  const userId = user.sub || user.id;

  // Build update object with only provided fields
  const updates: any = {};
  if (
    name !== undefined &&
    typeof name === "string" &&
    name.trim().length > 0
  ) {
    updates.name = name.trim();
  }
  if (color !== undefined) {
    updates.color = color;
  }
  if (icon !== undefined) {
    updates.icon = icon;
  }

  if (Object.keys(updates).length === 0) {
    throw createError({
      statusCode: 400,
      message: "No valid fields to update",
    });
  }

  const { data, error } = await supabase
    .from("folders")
    .update(updates)
    .eq("id", folderId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    // Check for unique constraint violation
    if (error.code === "23505") {
      throw createError({
        statusCode: 409,
        message: "A folder with this name already exists",
      });
    }

    throw createError({
      statusCode: 500,
      message: error.message,
    });
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      message: "Folder not found",
    });
  }

  return data;
});
