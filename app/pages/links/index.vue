<script setup lang="ts">
import type { Link, Folder } from "~/../../types";

const supabase = useSupabaseClient();
const user = useSupabaseUser();
const router = useRouter();

// Fetch folders
const { data: folders, pending: foldersLoading } = await useAsyncData<Folder[]>(
  "folders",
  async () => {
    const userId = user.value?.sub;
    if (!userId) return [];

    const { data, error } = await supabase
      .from("folders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching folders:", error);
      return [];
    }

    return (data as Folder[]) || [];
  },
  {}
);

// Fetch links for counts
const { data: links } = await useAsyncData<Link[]>(
  "links",
  async () => {
    const userId = user.value?.sub;
    if (!userId) return [];

    const { data, error } = await supabase
      .from("links")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching links:", error);
      return [];
    }

    return (data as Link[]) || [];
  },
  {}
);

// Count links in each folder
const folderLinkCounts = computed(() => {
  if (!links.value) return {};

  const counts: Record<string, number> = {};
  links.value.forEach((link) => {
    if (link.folder_id) {
      counts[link.folder_id] = (counts[link.folder_id] || 0) + 1;
    }
  });

  return counts;
});

const unsortedCount = computed(() => {
  if (!links.value) return 0;
  return links.value.filter((link) => !link.folder_id).length;
});

const isFolderModalOpen = ref(false);
const folderForm = ref({
  name: "",
  color: "#f59e0b",
  icon: "folder",
});

function navigateToFolder(folderId: string | null) {
  let path = "/links/all";
  if (folderId === "unsorted") {
    path = "/links/unsorted";
  } else if (folderId) {
    path = `/links/${folderId}`;
  }
  router.push(path);
}

function openFolderModal() {
  folderForm.value = {
    name: "",
    color: "#f59e0b",
    icon: "folder",
  };
  isFolderModalOpen.value = true;
}

async function createFolder() {
  const toast = useToast();

  if (!folderForm.value.name.trim()) {
    toast.add({
      title: "Error",
      description: "Folder name is required",
      color: "error",
    });
    return;
  }

  try {
    await $fetch("/api/folders", {
      method: "POST",
      body: folderForm.value,
    });

    toast.add({
      title: "Success",
      description: "Folder created successfully",
      color: "success",
    });

    isFolderModalOpen.value = false;

    // Refresh the page to show the new folder
    window.location.reload();
  } catch (e: any) {
    console.error("Error creating folder:", e);
    toast.add({
      title: "Error",
      description: e.data?.message || "Failed to create folder",
      color: "error",
    });
  }
}
</script>

<template>
  <div>
    <UContainer class="py-8">
      <div class="space-y-6">
        <!-- Add Link Button -->
        <UButton
          to="/"
          icon="i-heroicons-plus"
          label="Add New Link"
          color="primary"
          size="lg"
          class="w-full"
        />

        <!-- Folder Header -->
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-bold">Folders</h2>
        </div>

        <!-- Folder Squares Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <!-- All Links Square -->
          <button
            class="w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-2 transition-all border-2 border-transparent hover:shadow-md"
            style="background-color: rgba(245, 158, 11, 0.1)"
            @click="navigateToFolder(null)"
          >
            <UIcon
              name="i-heroicons-folder-open"
              class="w-8 h-8"
              style="color: #f59e0b"
            />
            <div class="text-center px-2">
              <div class="font-semibold text-base">All</div>
              <div class="text-sm text-gray-500">
                {{ links?.length || 0 }}
              </div>
            </div>
          </button>

          <!-- Unsorted Square -->
          <button
            class="w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-2 transition-all border-2 border-transparent hover:shadow-md"
            style="background-color: rgba(107, 114, 128, 0.1)"
            @click="navigateToFolder('unsorted')"
          >
            <UIcon
              name="i-heroicons-inbox"
              class="w-8 h-8"
              style="color: #6b7280"
            />
            <div class="text-center px-2">
              <div class="font-semibold text-base">Unsorted</div>
              <div class="text-sm text-gray-500">{{ unsortedCount }}</div>
            </div>
          </button>

          <!-- Custom Folders -->
          <button
            v-for="folder in folders"
            :key="folder.id"
            class="w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-2 transition-all border-2 border-transparent hover:shadow-md"
            :style="{
              backgroundColor: folder.color + '20',
            }"
            @click="navigateToFolder(folder.id)"
          >
            <UIcon
              :name="`i-heroicons-${folder.icon}`"
              class="w-8 h-8"
              :style="{ color: folder.color }"
            />
            <div class="text-center px-2">
              <div class="font-semibold text-base truncate">
                {{ folder.name }}
              </div>
              <div class="text-sm text-gray-500">
                {{ folderLinkCounts[folder.id] || 0 }}
              </div>
            </div>
          </button>

          <!-- Create New Folder Box -->
          <button
            class="w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-2 transition-all border-2 border-dashed border-gray-300 hover:border-primary-500 hover:bg-primary-50"
            @click="openFolderModal"
          >
            <UIcon
              name="i-heroicons-plus-circle"
              class="w-8 h-8 text-gray-400"
            />
            <div class="text-center px-2">
              <div class="font-semibold text-base text-gray-600">New Folder</div>
            </div>
          </button>
        </div>

        <!-- Empty State for No Folders -->
        <div
          v-if="!folders || folders.length === 0"
          class="text-sm text-gray-500 text-center py-4"
        >
          No custom folders yet. Create one to organize your links!
        </div>

        <!-- Loading State -->
        <div v-if="foldersLoading" class="flex justify-center py-4">
          <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
        </div>
      </div>
    </UContainer>

    <!-- Create Folder Modal -->
    <UModal v-model:open="isFolderModalOpen" prevent-close>
      <template #content>
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-semibold">Create Folder</h3>
            <UButton
              icon="i-heroicons-x-mark"
              variant="ghost"
              color="neutral"
              size="xs"
              @click="isFolderModalOpen = false"
            />
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">Folder Name</label>
              <UInput
                v-model="folderForm.name"
                class="w-full"
                placeholder="Enter folder name..."
                size="lg"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">Color</label>
              <input
                v-model="folderForm.color"
                type="color"
                class="w-full h-10 rounded-lg border border-gray-300 cursor-pointer"
              />
            </div>
          </div>

          <div class="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200">
            <UButton color="error" size="md" @click="isFolderModalOpen = false">
              Cancel
            </UButton>
            <UButton color="primary" size="md" @click="createFolder">
              Create Folder
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
