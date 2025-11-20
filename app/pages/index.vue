<script setup lang="ts">
import type { Folder } from "~/types";

interface ParsedLinkData {
  url: string;
  title: string;
  description: string | null;
  image: string | null;
  siteName: string | null;
  platform: string;
  favicon: string;
  suggestedTags: string[];
}

const supabase = useSupabaseClient();
const user = useSupabaseUser();
const toast = useToast();

const link = ref("");
const loading = ref(false);
const saving = ref(false);
const parsedData = ref<ParsedLinkData | null>(null);
const error = ref("");

// Editable fields
const editableTitle = ref("");
const editableDescription = ref("");
const editableImage = ref("");
const editableTags = ref<string[]>([]);
const selectedFolderId = ref<string | null>(null);
const newTag = ref("");
const isCreatingFolder = ref(false);
const newFolderName = ref("");

// Fetch folders
const {
  data: folders,
  pending: foldersLoading,
  refresh: refreshFolders,
} = await useAsyncData<Pick<Folder, "id" | "name">[]>(
  "folders",
  async () => {
    const userId = user.value?.sub;
    if (!userId) return [];

    const { data, error } = await supabase
      .from("folders")
      .select("id, name")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching folders:", error);
      return [];
    }

    return (data as Pick<Folder, "id" | "name">[]) || [];
  },
  {}
);

async function saveLink() {
  if (!link.value) {
    error.value = "Please enter a URL";
    return;
  }

  loading.value = true;
  error.value = "";
  parsedData.value = null;

  try {
    const data = await $fetch("/api/parse-link", {
      method: "POST",
      body: {
        url: link.value,
      },
    });

    parsedData.value = data;

    // Populate editable fields with parsed data
    editableTitle.value = data.title;
    editableDescription.value = data.description || "";
    editableImage.value = data.image || "";
    editableTags.value = [...data.suggestedTags];

    console.log("Parsed link data:", data);
  } catch (e: any) {
    error.value = e.data?.message || "Failed to parse link";
    console.error("Error parsing link:", e);
  } finally {
    loading.value = false;
  }
}

function addTag() {
  if (newTag.value && !editableTags.value.includes(newTag.value)) {
    editableTags.value.push(newTag.value);
    newTag.value = "";
  }
}

function removeTag(tag: string) {
  editableTags.value = editableTags.value.filter((t) => t !== tag);
}

async function saveEditedLink() {
  // Supabase user ID is in the 'sub' property
  const userId = user.value?.sub || user.value?.id;

  if (!user.value || !userId) {
    toast.add({
      title: "Error",
      description: "You must be logged in to save links",
      color: "error",
    });
    return;
  }

  if (!parsedData.value) {
    toast.add({
      title: "Error",
      description: "No link data to save",
      color: "error",
    });
    return;
  }

  saving.value = true;

  try {
    console.log("Saving link with user_id:", userId);

    const { error: dbError } = await supabase.from("links").insert({
      user_id: userId,
      url: parsedData.value.url,
      title: editableTitle.value,
      description: editableDescription.value || null,
      image: editableImage.value || null,
      site_name: parsedData.value.siteName,
      platform: parsedData.value.platform,
      favicon: parsedData.value.favicon,
      tags: editableTags.value,
      folder_id: selectedFolderId.value,
    } as any);

    if (dbError) throw dbError;

    toast.add({
      title: "Success",
      description: "Link saved successfully!",
      color: "success",
    });

    // Reset form
    cancelEdit();
    link.value = "";
  } catch (e: any) {
    console.error("Error saving link:", e);
    toast.add({
      title: "Error",
      description: e.message || "Failed to save link",
      color: "error",
    });
  } finally {
    saving.value = false;
  }
}

async function createQuickFolder() {
  if (!newFolderName.value.trim()) {
    toast.add({
      title: "Error",
      description: "Folder name is required",
      color: "error",
    });
    return;
  }

  try {
    const newFolder = await $fetch("/api/folders", {
      method: "POST",
      body: {
        name: newFolderName.value.trim(),
        color: "#6366f1",
        icon: "folder",
      },
    });

    toast.add({
      title: "Success",
      description: "Folder created successfully",
      color: "success",
    });

    await refreshFolders();
    selectedFolderId.value = (newFolder as any).id;
    isCreatingFolder.value = false;
    newFolderName.value = "";
  } catch (e: any) {
    console.error("Error creating folder:", e);
    toast.add({
      title: "Error",
      description: e.data?.message || "Failed to create folder",
      color: "error",
    });
  }
}

function cancelEdit() {
  parsedData.value = null;
  editableTitle.value = "";
  editableDescription.value = "";
  editableImage.value = "";
  editableTags.value = [];
  selectedFolderId.value = null;
  isCreatingFolder.value = false;
  newFolderName.value = "";
}
</script>

<template>
  <div>
    <UContainer class="py-8">
      <div class="space-y-6">
        <!-- Input Section -->
        <div class="space-y-4">
          <h1 class="text-3xl font-bold">Add a Link</h1>
          <div class="flex gap-2">
            <UInput
              v-model="link"
              placeholder="Paste a URL here..."
              size="lg"
              class="flex-1"
              :disabled="loading"
            />
            <UButton
              label="Save"
              @click="saveLink"
              :loading="loading"
              size="lg"
            />
          </div>
          <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>
        </div>

        <!-- Edit Card -->
        <UCard v-if="parsedData" class="overflow-hidden">
          <template #header>
            <div class="flex items-center gap-3">
              <img
                :src="parsedData.favicon"
                :alt="parsedData.platform"
                class="w-6 h-6"
              />
              <div class="flex-1">
                <p class="text-sm text-gray-500">{{ parsedData.platform }}</p>
              </div>
            </div>
          </template>

          <div class="space-y-4">
            <!-- Image Preview -->
            <div v-if="editableImage">
              <img
                :src="editableImage"
                :alt="editableTitle"
                class="w-full max-h-64 object-contain rounded-lg bg-gray-50"
              />
            </div>

            <!-- Editable Title -->
            <div>
              <label class="block text-sm font-medium mb-1">Title</label>
              <UInput
                v-model="editableTitle"
                placeholder="Enter title..."
                size="lg"
                class="w-full"
              />
            </div>

            <!-- Editable Description -->
            <div>
              <label class="block text-sm font-medium mb-1">Description</label>
              <UTextarea
                v-model="editableDescription"
                placeholder="Enter description..."
                class="w-full"
              />
            </div>

            <!-- Tags -->
            <div>
              <label class="block text-sm font-medium mb-1">Tags</label>
              <div
                v-if="editableTags.length > 0"
                class="flex flex-wrap gap-2 mb-2"
              >
                <UBadge
                  v-for="tag in editableTags"
                  :key="tag"
                  color="primary"
                  variant="subtle"
                  class="cursor-pointer"
                  @click="removeTag(tag)"
                >
                  {{ tag }}
                </UBadge>
              </div>
              <div class="flex gap-2 w-full">
                <UInput
                  v-model="newTag"
                  placeholder="Add a tag..."
                  @keyup.enter="addTag"
                  class="flex-1"
                />
                <UButton @click="addTag">Add</UButton>
              </div>
            </div>

            <!-- Folder Selection -->
            <div>
              <label class="block text-sm font-medium mb-1">
                Folder (Optional)
              </label>

              <!-- Show folder selector when not creating -->
              <div v-if="!isCreatingFolder" class="space-y-2">
                <USelectMenu
                  v-model="selectedFolderId"
                  :items="[
                    { id: null, name: 'None (Unsorted)' },
                    ...(folders || []),
                  ]"
                  value-key="id"
                  label-key="name"
                  placeholder="Select a folder..."
                  size="lg"
                  class="w-full"
                />
                <UButton
                  @click="isCreatingFolder = true"
                  size="sm"
                  icon="i-heroicons-plus-circle"
                >
                  Create New Folder
                </UButton>
              </div>

              <!-- Show folder creation input -->
              <div v-else class="space-y-2">
                <div class="flex gap-2">
                  <UInput
                    v-model="newFolderName"
                    placeholder="Folder name..."
                    class="flex-1 w-full"
                    size="lg"
                    @keyup.enter="createQuickFolder"
                  />
                  <UButton
                    size="lg"
                    color="error"
                    @click="
                      isCreatingFolder = false;
                      newFolderName = '';
                    "
                  >
                    Cancel
                  </UButton>
                  <UButton size="lg" @click="createQuickFolder">Create</UButton>
                </div>
              </div>
            </div>

            <!-- Original URL (Read-only) -->
            <div>
              <label class="block text-sm font-medium mb-1">URL</label>
              <div
                class="text-sm text-gray-500 p-2 bg-gray-50 rounded break-all"
              >
                <a
                  :href="parsedData.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="hover:text-primary-500"
                >
                  {{ parsedData.url }}
                </a>
              </div>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton variant="ghost" @click="cancelEdit" :disabled="saving"
                >Cancel</UButton
              >
              <UButton
                color="primary"
                @click="saveEditedLink"
                :loading="saving"
                :disabled="saving"
              >
                Save Link
              </UButton>
            </div>
          </template>
        </UCard>
      </div>
    </UContainer>
  </div>
</template>
