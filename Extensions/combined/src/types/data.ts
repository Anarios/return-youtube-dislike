export type StoredData = {
  likes: number;
  dislikes: number;
  previousState: DataState;
};

export type DataState = "LIKED_STATE" | "DISLIKED_STATE" | "NEUTRAL_STATE";
