<script setup lang="ts">
import type { Link, Folder } from "~/types";

const route = useRoute();
const router = useRouter();
const supabase = useSupabaseClient();
const user = useSupabaseUser();
const toast = useToast();

const isEditModalOpen = ref(false);
const isFolderModalOpen = ref(false);
const isEditFolderModalOpen = ref(false);
const editingLink = ref<Link | null>(null);
const editingFolder = ref<Folder | null>(null);

// For mobile: track if we should show folder view
// Initialize based on whether we're already on a folder route
// Only show folder view if there's actually a folder param (not undefined or empty)
const showMobileFolderView = ref(!!route.params.folder);

const editForm = ref({
  title: "",
  description: "",
  tags: [] as string[],
});
const newTag = ref("");

const folderForm = ref({
  name: "",
  color: "#f59e0b",
  icon: "folder",
});

// Get folder ID from route
const selectedFolderId = computed(() => {
  const folderParam = route.params.folder as string;
  if (folderParam === 'all') return null;
  if (folderParam === 'unsorted') return 'unsorted';
  return folderParam;
});

// Fetch folders
const {
  data: folders,
  pending: foldersLoading,
  refresh: refreshFolders,
} = await useAsyncData<Folder[]>(
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

// Fetch links
const {
  data: links,
  pending: loading,
  refresh,
} = await useAsyncData<Link[]>(
  "links",
  async () => {
    const userId = user.value?.sub;

    if (!userId) {
      return [];
    }

    const { data, error } = await supabase
      .from("links")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching links:", error);
      toast.add({
        title: "Error",
        description: error.message || "Failed to fetch links",
        color: "error",
      });
      return [];
    }

    return (data as Link[]) || [];
  },
  {}
);

// Filter links based on selected folder
const filteredLinks = computed(() => {
  if (!links.value) return [];

  if (selectedFolderId.value === null) {
    // Show all links
    return links.value;
  } else if (selectedFolderId.value === "unsorted") {
    // Show links without a folder
    return links.value.filter((link) => !link.folder_id);
  } else {
    // Show links in specific folder
    return links.value.filter(
      (link) => link.folder_id === selectedFolderId.value
    );
  }
});

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

// Navigation helpers
function navigateToFolder(folderId: string | null) {
  let path = '/links/all';
  if (folderId === 'unsorted') {
    path = '/links/unsorted';
  } else if (folderId) {
    path = `/links/${folderId}`;
  }
  router.push(path);
}

function openEditModal(link: Link, event: Event) {
  event.preventDefault();
  event.stopPropagation();
  editingLink.value = link;
  editForm.value = {
    title: link.title,
    description: link.description || "",
    tags: [...link.tags],
  };
  isEditModalOpen.value = true;
}

function openFolderModal() {
  folderForm.value = {
    name: "",
    color: "#6366f1",
    icon: "folder",
  };
  isFolderModalOpen.value = true;
}

function openEditFolderModal(folder: Folder) {
  editingFolder.value = folder;
  folderForm.value = {
    name: folder.name,
    color: folder.color,
    icon: folder.icon,
  };
  isEditFolderModalOpen.value = true;
}

function addTag() {
  if (newTag.value && !editForm.value.tags.includes(newTag.value)) {
    editForm.value.tags.push(newTag.value);
    newTag.value = "";
  }
}

function removeTag(tag: string) {
  editForm.value.tags = editForm.value.tags.filter((t) => t !== tag);
}

async function saveEdit() {
  if (!editingLink.value) return;

  try {
    const { error } = await supabase
      .from("links")
      .update({
        title: editForm.value.title,
        description: editForm.value.description || null,
        tags: editForm.value.tags,
      })
      .eq("id", editingLink.value.id);

    if (error) throw error;

    toast.add({
      title: "Success",
      description: "Link updated successfully",
      color: "success",
    });

    isEditModalOpen.value = false;
    editingLink.value = null;
    await refresh();
  } catch (e: any) {
    console.error("Error updating link:", e);
    toast.add({
      title: "Error",
      description: e.message || "Failed to update link",
      color: "error",
    });
  }
}

function cancelEdit() {
  isEditModalOpen.value = false;
  editingLink.value = null;
  editForm.value = {
    title: "",
    description: "",
    tags: [],
  };
  newTag.value = "";
}

async function createFolder() {
  if (!folderForm.value.name.trim()) {
    toast.add({
      title: "Error",
      description: "Folder name is required",
      color: "error",
    });
    return;
  }

  try {
    const { error } = await $fetch("/api/folders", {
      method: "POST",
      body: folderForm.value,
    });

    if (error) throw error;

    toast.add({
      title: "Success",
      description: "Folder created successfully",
      color: "success",
    });

    isFolderModalOpen.value = false;
    await refreshFolders();
  } catch (e: any) {
    console.error("Error creating folder:", e);
    toast.add({
      title: "Error",
      description: e.data?.message || "Failed to create folder",
      color: "error",
    });
  }
}

async function updateFolder() {
  if (!editingFolder.value) return;

  try {
    await $fetch(`/api/folders/${editingFolder.value.id}`, {
      method: "PUT",
      body: folderForm.value,
    });

    toast.add({
      title: "Success",
      description: "Folder updated successfully",
      color: "success",
    });

    isEditFolderModalOpen.value = false;
    editingFolder.value = null;
    await refreshFolders();
  } catch (e: any) {
    console.error("Error updating folder:", e);
    toast.add({
      title: "Error",
      description: e.data?.message || "Failed to update folder",
      color: "error",
    });
  }
}

async function deleteFolder(folderId: string) {
  if (
    !confirm(
      "Are you sure you want to delete this folder? Links will not be deleted."
    )
  ) {
    return;
  }

  try {
    await $fetch(`/api/folders/${folderId}`, {
      method: "DELETE",
    });

    toast.add({
      title: "Success",
      description: "Folder deleted successfully",
      color: "success",
    });

    // Navigate to "all" if we're deleting the current folder
    if (selectedFolderId.value === folderId) {
      navigateToFolder(null);
    }

    await refreshFolders();
    await refresh();
  } catch (e: any) {
    console.error("Error deleting folder:", e);
    toast.add({
      title: "Error",
      description: e.data?.message || "Failed to delete folder",
      color: "error",
    });
  }
}

async function moveLink(linkId: string, folderId: string | null) {
  try {
    await $fetch(`/api/links/${linkId}/move`, {
      method: "PUT",
      body: { folder_id: folderId },
    });

    toast.add({
      title: "Success",
      description: "Link moved successfully",
      color: "success",
    });

    await refresh();
  } catch (e: any) {
    console.error("Error moving link:", e);
    toast.add({
      title: "Error",
      description: e.data?.message || "Failed to move link",
      color: "error",
    });
  }
}

async function deleteLink(linkId: string, event: Event) {
  event.preventDefault();
  event.stopPropagation();

  if (!confirm("Are you sure you want to delete this link?")) {
    return;
  }

  try {
    const { error } = await supabase.from("links").delete().eq("id", linkId);

    if (error) throw error;

    toast.add({
      title: "Success",
      description: "Link deleted successfully",
      color: "success",
    });

    await refresh();
  } catch (e: any) {
    console.error("Error deleting link:", e);
    toast.add({
      title: "Error",
      description: e.message || "Failed to delete link",
      color: "error",
    });
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

// For mobile: toggle folder view
function selectFolderMobile(folderId: string | null) {
  showMobileFolderView.value = true;
  navigateToFolder(folderId);
}

function backToFoldersMobile() {
  showMobileFolderView.value = false;
  // Navigate back to the folder list route
  router.push('/links');
}

// Watch for route changes to update mobile folder view state
watch(() => route.params.folder, (newFolder) => {
  // Show folder view only when we have a valid folder param
  showMobileFolderView.value = !!newFolder;
});
</script>

<template>
  <div>
    <UContainer class="py-8">
      <div class="flex gap-6">
        <!-- Sidebar (Desktop) -->
        <div class="hidden lg:block w-64 shrink-0">
          <div class="sticky top-8 space-y-4">
            <!-- Add Link Button -->
            <UButton
              to="/"
              icon="i-heroicons-plus"
              label="Add New Link"
              color="primary"
              size="md"
              class="w-full"
            />

            <!-- Header -->
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold">Folders</h2>
              <UButton
                icon="i-heroicons-plus"
                size="xs"
                variant="ghost"
                @click="openFolderModal"
              />
            </div>

            <!-- All Links -->
            <button
              class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors"
              :class="
                selectedFolderId === null
                  ? 'bg-primary-50 text-primary-600'
                  : 'hover:bg-gray-100'
              "
              @click="navigateToFolder(null)"
            >
              <UIcon name="i-heroicons-folder-open" class="w-5 h-5" style="color: #f59e0b" />
              <span class="flex-1 font-medium">All Links</span>
              <span class="text-sm text-gray-500">{{
                links?.length || 0
              }}</span>
            </button>

            <!-- Unsorted -->
            <button
              class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors"
              :class="
                selectedFolderId === 'unsorted'
                  ? 'bg-primary-50 text-primary-600'
                  : 'hover:bg-gray-100'
              "
              @click="navigateToFolder('unsorted')"
            >
              <UIcon name="i-heroicons-inbox" class="w-5 h-5" />
              <span class="flex-1 font-medium">Unsorted</span>
              <span class="text-sm text-gray-500">{{ unsortedCount }}</span>
            </button>

            <!-- Folders List -->
            <div v-if="foldersLoading" class="flex justify-center py-4">
              <UIcon
                name="i-heroicons-arrow-path"
                class="w-5 h-5 animate-spin"
              />
            </div>

            <div v-else-if="folders && folders.length > 0" class="space-y-1">
              <div
                v-for="folder in folders"
                :key="folder.id"
                class="group relative"
              >
                <button
                  class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors"
                  :class="
                    selectedFolderId === folder.id
                      ? 'bg-primary-50 text-primary-600'
                      : 'hover:bg-gray-100'
                  "
                  @click="navigateToFolder(folder.id)"
                >
                  <UIcon
                    :name="`i-heroicons-${folder.icon}`"
                    class="w-5 h-5"
                    :style="{ color: folder.color }"
                  />
                  <span class="flex-1 font-medium truncate">{{
                    folder.name
                  }}</span>
                  <span class="text-sm text-gray-500">
                    {{ folderLinkCounts[folder.id] || 0 }}
                  </span>
                </button>
                <UDropdownMenu
                  :items="[
                    [
                      {
                        label: 'Edit',
                        icon: 'i-heroicons-pencil-square',
                        onSelect: () => openEditFolderModal(folder),
                      },
                      {
                        label: 'Delete',
                        icon: 'i-heroicons-trash',
                        color: 'error',
                        onSelect: () => deleteFolder(folder.id),
                      },
                    ],
                  ]"
                >
                  <div
                    class="absolute right-2 top-1/2 -translate-y-1/2 flex p-1 bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    @click.stop
                  >
                    <UIcon
                      name="i-heroicons-ellipsis-vertical"
                      class="h-4 w-4 hover:opacity-75 text-slate-600"
                    />
                  </div>
                </UDropdownMenu>
              </div>
            </div>

            <div v-else class="text-sm text-gray-500 px-3">
              No folders yet. Create one to organize your links!
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <div class="flex-1 space-y-6">
          <!-- Mobile Folder Navigation -->
          <div class="lg:hidden space-y-4">
            <!-- Folder Grid View (Default) -->
            <div v-if="!showMobileFolderView">
              <!-- Add Link Button (Mobile) -->
              <UButton
                to="/"
                icon="i-heroicons-plus"
                label="Add New Link"
                color="primary"
                size="md"
                class="w-full mb-4"
              />

              <!-- Folder Grid -->
              <div>
                <div class="flex items-center justify-between mb-3">
                  <h2 class="text-lg font-semibold">Folders</h2>
                  <UButton
                    icon="i-heroicons-plus"
                    size="xs"
                    variant="ghost"
                    @click="openFolderModal"
                  />
                </div>

                <!-- Folder Squares Grid (Including All & Unsorted) -->
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <!-- All Links Square -->
                  <button
                    class="w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-2 transition-all border-2"
                    :class="
                      selectedFolderId === null && !showMobileFolderView
                        ? 'border-primary-500 shadow-md'
                        : 'border-transparent hover:shadow-md'
                    "
                    style="background-color: rgba(245, 158, 11, 0.1)"
                    @click="selectFolderMobile(null)"
                  >
                    <UIcon
                      name="i-heroicons-folder-open"
                      class="w-8 h-8"
                      style="color: #f59e0b"
                    />
                    <div class="text-center px-2">
                      <div class="font-semibold text-sm">All</div>
                      <div class="text-xs text-gray-500">
                        {{ links?.length || 0 }}
                      </div>
                    </div>
                  </button>

                  <!-- Unsorted Square -->
                  <button
                    class="w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-2 transition-all border-2"
                    :class="
                      selectedFolderId === 'unsorted' && !showMobileFolderView
                        ? 'border-primary-500 shadow-md'
                        : 'border-transparent hover:shadow-md'
                    "
                    style="background-color: rgba(107, 114, 128, 0.1)"
                    @click="selectFolderMobile('unsorted')"
                  >
                    <UIcon
                      name="i-heroicons-inbox"
                      class="w-8 h-8"
                      style="color: #6b7280"
                    />
                    <div class="text-center px-2">
                      <div class="font-semibold text-sm">Unsorted</div>
                      <div class="text-xs text-gray-500">{{ unsortedCount }}</div>
                    </div>
                  </button>

                  <!-- Custom Folders -->
                  <div
                    v-for="folder in folders"
                    :key="folder.id"
                    class="relative group"
                  >
                    <button
                      class="w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-2 transition-all border-2 border-transparent hover:shadow-md"
                      :style="{
                        backgroundColor: folder.color + '20',
                      }"
                      @click="selectFolderMobile(folder.id)"
                    >
                      <UIcon
                        :name="`i-heroicons-${folder.icon}`"
                        class="w-8 h-8"
                        :style="{ color: folder.color }"
                      />
                      <div class="text-center px-2">
                        <div class="font-semibold text-sm truncate">
                          {{ folder.name }}
                        </div>
                        <div class="text-xs text-gray-500">
                          {{ folderLinkCounts[folder.id] || 0 }}
                        </div>
                      </div>
                    </button>

                    <!-- Actions Dropdown -->
                    <UDropdownMenu
                      :items="[
                        [
                          {
                            label: 'Edit',
                            icon: 'i-heroicons-pencil-square',
                            onSelect: () => openEditFolderModal(folder),
                          },
                          {
                            label: 'Delete',
                            icon: 'i-heroicons-trash',
                            color: 'error',
                            onSelect: () => deleteFolder(folder.id),
                          },
                        ],
                      ]"
                    >
                      <div
                        class="absolute top-1 right-1 flex p-1 bg-white rounded-md shadow-sm opacity-0 group-active:opacity-100 transition-opacity"
                        @click.stop
                      >
                        <UIcon
                          name="i-heroicons-ellipsis-vertical"
                          class="h-4 w-4 text-slate-600"
                        />
                      </div>
                    </UDropdownMenu>
                  </div>

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
                      <div class="font-semibold text-sm text-gray-600">New Folder</div>
                    </div>
                  </button>
                </div>

                <!-- Empty State for No Folders -->
                <div
                  v-if="!folders || folders.length === 0"
                  class="text-sm text-gray-500 text-center py-4 mt-4"
                >
                  No custom folders yet. Create one to organize your links!
                </div>
              </div>
            </div>

            <!-- Folder Detail View (Mobile) -->
            <div v-else>
              <!-- Back Button -->
              <button
                class="flex items-center gap-2 text-primary-600 mb-4 -ml-1"
                @click="backToFoldersMobile"
              >
                <UIcon name="i-heroicons-arrow-left" class="w-5 h-5" />
                <span class="font-medium">Back to Folders</span>
              </button>

              <!-- Folder Header -->
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                  <!-- Folder Icon -->
                  <div
                    v-if="selectedFolderId === null"
                    class="w-12 h-12 rounded-xl flex items-center justify-center"
                    style="background-color: rgba(245, 158, 11, 0.1)"
                  >
                    <UIcon
                      name="i-heroicons-folder-open"
                      class="w-7 h-7"
                      style="color: #f59e0b"
                    />
                  </div>
                  <div
                    v-else-if="selectedFolderId === 'unsorted'"
                    class="w-12 h-12 rounded-xl flex items-center justify-center"
                    style="background-color: rgba(107, 114, 128, 0.1)"
                  >
                    <UIcon
                      name="i-heroicons-inbox"
                      class="w-7 h-7"
                      style="color: #6b7280"
                    />
                  </div>
                  <div
                    v-else
                    class="w-12 h-12 rounded-xl flex items-center justify-center"
                    :style="{
                      backgroundColor:
                        folders?.find((f) => f.id === selectedFolderId)
                          ?.color + '20',
                    }"
                  >
                    <UIcon
                      :name="`i-heroicons-${folders?.find((f) => f.id === selectedFolderId)?.icon}`"
                      class="w-7 h-7"
                      :style="{
                        color: folders?.find((f) => f.id === selectedFolderId)
                          ?.color,
                      }"
                    />
                  </div>

                  <!-- Folder Name and Count -->
                  <div>
                    <h2 class="text-xl font-bold">
                      {{
                        selectedFolderId === null
                          ? "All"
                          : selectedFolderId === "unsorted"
                          ? "Unsorted"
                          : folders?.find((f) => f.id === selectedFolderId)?.name
                      }}
                    </h2>
                    <p class="text-sm text-gray-500">
                      {{ filteredLinks.length }}
                      {{ filteredLinks.length === 1 ? "link" : "links" }}
                    </p>
                  </div>
                </div>

                <!-- Folder Actions -->
                <UDropdownMenu
                  v-if="selectedFolderId && selectedFolderId !== 'unsorted'"
                  :items="[
                    [
                      {
                        label: 'Edit Folder',
                        icon: 'i-heroicons-pencil-square',
                        onSelect: () =>
                          openEditFolderModal(
                            folders?.find((f) => f.id === selectedFolderId)!
                          ),
                      },
                      {
                        label: 'Delete Folder',
                        icon: 'i-heroicons-trash',
                        color: 'error',
                        onSelect: () => {
                          if (selectedFolderId) {
                            deleteFolder(selectedFolderId);
                            showMobileFolderView = false;
                          }
                        },
                      },
                    ],
                  ]"
                >
                  <UButton
                    icon="i-heroicons-ellipsis-vertical"
                    variant="ghost"
                    size="sm"
                  />
                </UDropdownMenu>
              </div>
            </div>
          </div>

          <!-- Header (Desktop Only) -->
          <div
            v-if="!showMobileFolderView"
            class="hidden lg:flex flex-col lg:flex-row lg:items-center lg:justify-between"
          >
            <div>
              <h1 class="text-3xl font-bold">
                {{
                  selectedFolderId === null
                    ? "All Links"
                    : selectedFolderId === "unsorted"
                    ? "Unsorted Links"
                    : folders?.find((f) => f.id === selectedFolderId)?.name ||
                      "Links"
                }}
              </h1>
              <p class="text-gray-500 mt-1">
                {{ filteredLinks.length }}
                {{ filteredLinks.length === 1 ? "link" : "links" }}
              </p>
            </div>
          </div>

          <!-- Loading State -->
          <div
            v-if="loading"
            class="flex justify-center py-12"
            :class="[showMobileFolderView ? 'block' : 'hidden lg:block']"
          >
            <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin" />
          </div>

          <!-- Empty State -->
          <UCard
            v-else-if="filteredLinks.length === 0"
            :class="[showMobileFolderView ? 'block' : 'hidden lg:block']"
          >
            <div class="text-center py-12">
              <UIcon
                name="i-heroicons-link"
                class="w-12 h-12 mx-auto text-gray-400 mb-4"
              />
              <h3 class="text-lg font-semibold mb-2">No links here!</h3>
              <p class="text-gray-500 mb-4">
                {{
                  selectedFolderId === "unsorted"
                    ? "All your links are organized in folders"
                    : "Start saving links to see them here"
                }}
              </p>
            </div>
          </UCard>

          <!-- Links Grid -->
          <div
            v-else
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            :class="[showMobileFolderView ? 'block' : 'hidden lg:grid']"
          >
            <UCard
              v-for="link in filteredLinks"
              :key="link.id"
              class="hover:shadow-lg transition-shadow h-full cursor-pointer"
              @click="
                navigateTo(link.url, {
                  external: true,
                  open: { target: '_blank' },
                })
              "
            >
              <template #header>
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-start gap-3 flex-1 min-w-0">
                    <img
                      :src="link.favicon"
                      :alt="link.platform"
                      class="w-8 h-8 rounded flex-shrink-0"
                    />
                    <div class="flex-1 min-w-0">
                      <h3 class="font-semibold truncate">{{ link.title }}</h3>
                      <p class="text-sm text-gray-500">{{ link.platform }}</p>
                    </div>
                  </div>
                  <UDropdownMenu
                    :items="[
                      [
                        {
                          label: 'Edit',
                          icon: 'i-heroicons-pencil-square',
                          onSelect: (e: Event) => openEditModal(link, e),
                        },
                        ...(folders && folders.length > 0
                          ? [
                              {
                                label: 'Move to Folder',
                                icon: 'i-heroicons-folder',
                                children: [
                                  {
                                    label: 'Unsorted',
                                    onSelect: () => moveLink(link.id, null),
                                  },
                                  ...folders.map((folder) => ({
                                    label: folder.name,
                                    onSelect: () => moveLink(link.id, folder.id),
                                  })),
                                ],
                              },
                            ]
                          : []),
                        {
                          label: 'Delete',
                          icon: 'i-heroicons-trash',
                          color: 'error',
                          onSelect: (e: Event) => deleteLink(link.id, e),
                        },
                      ],
                    ]"
                  >
                    <div
                      class="flex p-1.5 bg-gray-100 rounded-lg self-start"
                      @click.stop
                    >
                      <UIcon
                        name="i-heroicons-ellipsis-vertical"
                        class="h-5 w-5 hover:opacity-75 text-slate-600"
                      />
                    </div>
                  </UDropdownMenu>
                </div>
              </template>

              <div class="space-y-3">
                <!-- Image Preview -->
                <div
                  v-if="link.image"
                  class="w-full aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden"
                >
                  <img
                    :src="link.image"
                    :alt="link.title"
                    class="w-full h-full object-cover"
                  />
                </div>

                <!-- Description -->
                <p class="text-sm text-gray-600 line-clamp-2">
                  {{ link.description || "No description available" }}
                </p>

                <!-- Tags -->
                <div v-if="link.tags.length > 0" class="flex flex-wrap gap-1">
                  <UBadge
                    v-for="tag in link.tags.slice(0, 3)"
                    :key="tag"
                    color="neutral"
                    variant="subtle"
                    size="xs"
                  >
                    {{ tag }}
                  </UBadge>
                  <UBadge
                    v-if="link.tags.length > 3"
                    color="neutral"
                    variant="subtle"
                    size="xs"
                  >
                    +{{ link.tags.length - 3 }}
                  </UBadge>
                </div>

                <!-- Date -->
                <p class="text-xs text-gray-400">
                  {{ formatDate(link.created_at) }}
                </p>
              </div>
            </UCard>
          </div>
        </div>
      </div>
    </UContainer>

    <!-- Edit Link Modal -->
    <UModal v-model:open="isEditModalOpen" prevent-close v-if="editingLink">
      <template #content>
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-semibold">Edit Link</h3>
            <UButton
              icon="i-heroicons-x-mark"
              variant="ghost"
              color="neutral"
              size="xs"
              @click="cancelEdit"
            />
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">Title</label>
              <UInput
                v-model="editForm.title"
                class="w-full"
                placeholder="Enter title..."
                size="lg"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">Description</label>
              <UTextarea
                v-model="editForm.description"
                class="w-full"
                placeholder="Enter description..."
                :rows="4"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">Tags</label>
              <div
                v-if="editForm.tags.length > 0"
                class="flex flex-wrap gap-2 mb-2"
              >
                <UBadge
                  v-for="tag in editForm.tags"
                  :key="tag"
                  color="primary"
                  variant="subtle"
                  class="cursor-pointer"
                  @click="removeTag(tag)"
                >
                  {{ tag }} ×
                </UBadge>
              </div>
              <div class="flex gap-2">
                <UInput
                  v-model="newTag"
                  placeholder="Add a tag..."
                  @keyup.enter="addTag"
                  class="flex-1"
                />
                <UButton size="md" @click="addTag">Add</UButton>
              </div>
            </div>
          </div>

          <div
            class="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200"
          >
            <UButton color="error" size="md" @click="cancelEdit"
              >Cancel</UButton
            >
            <UButton color="primary" size="md" @click="saveEdit"
              >Save Changes</UButton
            >
          </div>
        </div>
      </template>
    </UModal>

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

          <div
            class="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200"
          >
            <UButton color="error" size="md" @click="isFolderModalOpen = false"
              >Cancel</UButton
            >
            <UButton color="primary" size="md" @click="createFolder"
              >Create Folder</UButton
            >
          </div>
        </div>
      </template>
    </UModal>

    <!-- Edit Folder Modal -->
    <UModal
      v-model:open="isEditFolderModalOpen"
      prevent-close
      v-if="editingFolder"
    >
      <template #content>
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-semibold">Edit Folder</h3>
            <UButton
              icon="i-heroicons-x-mark"
              variant="ghost"
              color="neutral"
              size="xs"
              @click="isEditFolderModalOpen = false"
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

          <div
            class="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200"
          >
            <UButton
              color="error"
              size="md"
              @click="isEditFolderModalOpen = false"
              >Cancel</UButton
            >
            <UButton color="primary" size="md" @click="updateFolder"
              >Save Changes</UButton
            >
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
