import { Dimensions } from "react-native";

/**
 * A horizontal ScrollView gives its content container no definite width, so a
 * percentage width resolves against the wrong box and cards grow unbounded.
 * Every carousel card pins itself to this instead.
 */
const screenWidth = Dimensions.get("window").width;

export const OPTION_CARD_WIDTH = Math.round(Math.min(Math.max(screenWidth * 0.82, 260), 340));
