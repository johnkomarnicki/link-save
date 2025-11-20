// Folder interface
export interface Folder {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  created_at: string;
  updated_at: string;
}

// Link interface (updated with folder_id)
export interface Link {
  id: string;
  user_id: string;
  url: string;
  title: string;
  description: string | null;
  image: string | null;
  site_name: string | null;
  platform: string;
  favicon: string;
  tags: string[];
  folder_id: string | null;
  created_at: string;
}

// Folder creation input
export interface CreateFolderInput {
  name: string;
  color?: string;
  icon?: string;
}

// Folder update input
export interface UpdateFolderInput {
  name?: string;
  color?: string;
  icon?: string;
}

// Move link input
export interface MoveLinkInput {
  folder_id: string | null;
}
