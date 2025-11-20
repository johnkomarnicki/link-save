// Create a new folder
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

  const body = await readBody(event);
  const { name, color, icon } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw createError({
      statusCode: 400,
      message: "Folder name is required",
    });
  }

  const userId = user.sub || user.id;

  const { data, error } = await supabase
    .from("folders")
    .insert({
      user_id: userId,
      name: name.trim(),
      color: color || "#6366f1",
      icon: icon || "folder",
    })
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

  return data;
});
