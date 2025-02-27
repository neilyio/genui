// client/src/js/theme.js
// We have 32 keys in UIChanges. Let's map them all:
const CSS_VAR_MAP = {
  primary_color: "--primary-color",
  secondary_color: "--secondary-color",
  background_color: "--background-color",
  text_color: "--text-color",
  page_bg: "--page-bg",
  bubble_size: "--bubble-size",
  bubble_padding: "--bubble-padding",
  bubble_radius: "--bubble-radius",
  bubble_shadow: "--bubble-shadow",
  bubble_max_width: "--bubble-max-width",
  font_family: "--font-family",
  font_size: "--font-size",
  line_height: "--line-height",
  spacing: "--spacing",
  chat_container_max_width: "--chat-container-max-width",
  animation_speed: "--animation-speed",
  transition_effect: "--transition-effect",
  border_width: "--border-width",
  border_style: "--border-style",
  border_color: "--border-color",
  global_border_radius: "--global-border-radius",
  input_background: "--input-background",
  chat_background: "--chat-background",
  header_background: "--header-background",
  header_text_color: "--header-text-color",
  user_message_background: "--user-message-background",
  user_message_text_color: "--user-message-text-color",
  assistant_message_background: "--assistant-message-background",
  assistant_message_text_color: "--assistant-message-text-color",
  message_margin_bottom: "--message-margin-bottom",
  user_message_border_color: "--user-message-border-color",
  assistant_message_border_color: "--assistant-message-border-color",
  // button_size:         '--button-size',
  // button_padding:      '--button-padding',
  // button_icon_size:    '--button-icon-size',
  button_icon_color: "--button-icon-color",
  send_button_bg: "--send-button-bg",
  send_button_color: "--send-button-color",
  attachment_button_bg: "--attachment-button-bg",
  attachment_button_color: "--attachment-button-color",
  info_button_color: "--info-button-color",
};

export function updateTheme(changes) {
  if (!changes) return;

  const root = document.documentElement;

  // Apply theme changes
  Object.entries(changes).forEach(([key, value]) => {
    if (value === null) return;
    const mappedVar = CSS_VAR_MAP[key];
    if (mappedVar) {
      root.style.setProperty(mappedVar, value);
    }
  });

  // Update font styles
  const fontProperties = [
    "header_font_family",
    "header_font_weight",
    "message_font_family",
    "message_font_weight",
    "placeholder_font_family",
    "placeholder_font_weight"
  ];

  fontProperties.forEach(prop => {
    if (changes[prop]) {
      const cssVarName = `--${prop.replace(/_/g, '-')}`;
      let cssVarValue = changes[prop];

      // If it's a font-family property, wrap in single quotes
      if (cssVarName.includes("font-family")) {
        cssVarValue = `'${cssVarValue}'`;
      }

      root.style.setProperty(cssVarName, cssVarValue);
    }
  });

  // Apply dependent updates
  updateDependentVariables();
}

function updateDependentVariables() {
  const root = document.documentElement;

  // Update text variables
  const textColor = getComputedStyle(root)
    .getPropertyValue("--text-color")
    .trim();
  root.style.setProperty("--text-primary", textColor);
  root.style.setProperty("--input-text", textColor);

  // Update background variables
  const backgroundColor = getComputedStyle(root)
    .getPropertyValue("--background-color")
    .trim();
  root.style.setProperty("--chat-bg", backgroundColor);

  // Get message styling properties
  const userMessageBackground = getComputedStyle(root)
    .getPropertyValue("--user-message-background")
    .trim();
  const assistantMessageBackground = getComputedStyle(root)
    .getPropertyValue("--assistant-message-background")
    .trim();
  const userMessageBorderColor = getComputedStyle(root)
    .getPropertyValue("--user-message-border-color")
    .trim();
  const assistantMessageBorderColor = getComputedStyle(root)
    .getPropertyValue("--assistant-message-border-color")
    .trim();

  // Set message backgrounds (for legacy support)
  root.style.setProperty("--user-message-bg", userMessageBackground);
  root.style.setProperty("--assistant-message-bg", assistantMessageBackground);

  // Set message borders
  root.style.setProperty(
    "--user-message-border",
    `${getComputedStyle(root).getPropertyValue("--border-width")
    } ${getComputedStyle(root).getPropertyValue("--border-style")} ${userMessageBorderColor} `,
  );
  root.style.setProperty(
    "--assistant-message-border",
    `${getComputedStyle(root).getPropertyValue("--border-width")} ${getComputedStyle(root).getPropertyValue("--border-style")} ${assistantMessageBorderColor} `,
  );

  // Update border colors
  const borderColor = getComputedStyle(root)
    .getPropertyValue("--border-color")
    .trim();
  root.style.setProperty("--input-border", borderColor);
}

