import { Fragment } from "react";
import { useColorScheme, View } from "react-native";
import { useMarkdown } from "react-native-marked";

export function Markdown({ text, inverted }: { text: string; inverted?: boolean }) {
  const scheme = useColorScheme();
  const dark = inverted ? scheme !== "dark" : scheme === "dark";
  const elements = useMarkdown(text, {
    colorScheme: dark ? "dark" : "light",
    theme: { colors: { text: dark ? "#f5f5f5" : "#171717", link: dark ? "#f5f5f5" : "#171717", code: dark ? "#262626" : "#f5f5f5", border: dark ? "#404040" : "#e5e5e5" } },
    styles: { text: { fontSize: 15, lineHeight: 22 }, paragraph: { paddingVertical: 0, marginBottom: 6 } },
  });
  return (
    <View>
      {elements.map((element, i) => (
        <Fragment key={i}>{element}</Fragment>
      ))}
    </View>
  );
}
