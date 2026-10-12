import { Fragment, useMemo, type ReactNode } from "react";
import { useColorScheme, View, type TextStyle } from "react-native";
import { Renderer, useMarkdown } from "react-native-marked";
import { isBareLink, splitUrlLines } from "@rply/schema";
import { LabeledLinkText, LinkCard, LinkText } from "./LinkPreview";

class LinkPreviewRenderer extends Renderer {
  link(children: string | ReactNode[], href: string, styles?: TextStyle, title?: string): ReactNode {
    if (typeof children === "string" && isBareLink(href, children)) return <LinkText key={this.getKey()} url={href} style={styles} />;
    if (/^https?:\/\//.test(href)) {
      return (
        <LabeledLinkText key={this.getKey()} url={href} style={styles}>
          {children}
        </LabeledLinkText>
      );
    }
    return super.link(children, href, styles, title);
  }
}

export function Markdown({ text, inverted }: { text: string; inverted?: boolean }) {
  const parts = useMemo(() => splitUrlLines(text), [text]);
  return (
    <View className="gap-2">
      {parts.map((part, i) => (part.type === "url" ? <LinkCard key={i} url={part.url} /> : <MarkdownText key={i} text={part.text} inverted={inverted} />))}
    </View>
  );
}

function MarkdownText({ text, inverted }: { text: string; inverted?: boolean }) {
  const scheme = useColorScheme();
  const dark = inverted ? scheme !== "dark" : scheme === "dark";
  const renderer = useMemo(() => new LinkPreviewRenderer(), []);
  const elements = useMarkdown(text, {
    colorScheme: dark ? "dark" : "light",
    renderer,
    theme: { colors: { text: dark ? "#f5f5f5" : "#171717", link: dark ? "#f5f5f5" : "#171717", code: dark ? "#262626" : "#f5f5f5", border: dark ? "#404040" : "#e5e5e5" } },
    styles: { text: { fontSize: 15, lineHeight: 22 }, paragraph: { paddingVertical: 0, marginBottom: 6 }, link: { fontStyle: "normal", textDecorationLine: "underline" } },
  });
  return (
    <View>
      {elements.map((element, i) => (
        <Fragment key={i}>{element}</Fragment>
      ))}
    </View>
  );
}
