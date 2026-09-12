export type AnimalTopLevelGroup = "buffalo" | "cow" | "calf" | "other";
export type AnimalGender = "male" | "female";
export type AnimalStatus = "active" | "sold" | "deceased";

export type AnimalCategory = {
  id: string;
  name: string;
  topLevelGroup: AnimalTopLevelGroup;
  active: boolean;
  createdAt: string;
};

export type Animal = {
  id: string;
  categoryId: string;
  /** Live join, not a snapshot — an animal record isn't a frozen financial
   *  document, so renaming a category should immediately show everywhere
   *  it's used, unlike e.g. a bill's line-item product name. */
  categoryName: string;
  categoryTopLevelGroup: AnimalTopLevelGroup;
  name: string | null;
  gender: AnimalGender;
  acquisitionDate: string; // yyyy-mm-dd
  status: AnimalStatus;
  saleDate: string | null;
  salePrice: number | null;
  deceasedDate: string | null;
  deceasedNote: string | null;
  note: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

/** Active-only counts, rolled up by topLevelGroup — feeds the dashboard and landing page. */
export type LivestockSummary = {
  buffalo: number;
  cow: number;
  calf: number;
  other: number;
  total: number;
};
