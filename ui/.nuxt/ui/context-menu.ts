const color = [
  "primary",
  "indigo",
  "emerald",
  "amber",
  "purple",
  "neutral"
] as const

const size = [
  "xs",
  "sm",
  "md",
  "lg",
  "xl"
] as const

export default {
  "slots": {
    "content": "min-w-32 bg-default shadow-lg rounded-md ring ring-default overflow-hidden data-[state=open]:animate-[scale-in_100ms_ease-out] data-[state=closed]:animate-[scale-out_100ms_ease-in] origin-(--reka-context-menu-content-transform-origin) flex flex-col",
    "viewport": "relative divide-y divide-default scroll-py-1 overflow-y-auto flex-1",
    "group": "p-1 isolate",
    "label": "w-full flex items-center font-semibold text-highlighted",
    "separator": "-mx-1 my-1 h-px bg-border",
    "item": "group relative w-full flex items-start select-none outline-none before:absolute before:z-[-1] before:inset-px before:rounded-md data-disabled:cursor-not-allowed data-disabled:opacity-75",
    "itemLeadingIcon": "shrink-0",
    "itemLeadingAvatar": "shrink-0",
    "itemLeadingAvatarSize": "",
    "itemTrailing": "ms-auto inline-flex gap-1.5 items-center",
    "itemTrailingIcon": "shrink-0",
    "itemTrailingKbds": "hidden lg:inline-flex items-center shrink-0",
    "itemTrailingKbdsSize": "",
    "itemWrapper": "flex-1 flex flex-col text-start min-w-0",
    "itemLabel": "truncate",
    "itemDescription": "truncate text-muted",
    "itemLabelExternalIcon": "inline-block size-3 align-top text-dimmed"
  },
  "variants": {
    "color": {
      "primary": "",
      "indigo": "",
      "emerald": "",
      "amber": "",
      "purple": "",
      "neutral": ""
    },
    "active": {
      "true": {
        "item": "text-highlighted before:bg-elevated",
        "itemLeadingIcon": "text-default"
      },
      "false": {
        "item": [
          "text-default data-highlighted:text-highlighted data-[state=open]:text-highlighted data-highlighted:before:bg-elevated/50 data-[state=open]:before:bg-elevated/50",
          "transition-colors before:transition-colors"
        ],
        "itemLeadingIcon": [
          "text-dimmed group-data-highlighted:text-default group-data-[state=open]:text-default",
          "transition-colors"
        ]
      }
    },
    "loading": {
      "true": {
        "itemLeadingIcon": "animate-spin"
      }
    },
    "size": {
      "xs": {
        "label": "p-1 text-xs gap-1",
        "item": "p-1 text-xs gap-1",
        "itemLeadingIcon": "size-4",
        "itemLeadingAvatarSize": "3xs",
        "itemTrailingIcon": "size-4",
        "itemTrailingKbds": "gap-0.5",
        "itemTrailingKbdsSize": "sm"
      },
      "sm": {
        "label": "p-1.5 text-xs gap-1.5",
        "item": "p-1.5 text-xs gap-1.5",
        "itemLeadingIcon": "size-4",
        "itemLeadingAvatarSize": "3xs",
        "itemTrailingIcon": "size-4",
        "itemTrailingKbds": "gap-0.5",
        "itemTrailingKbdsSize": "sm"
      },
      "md": {
        "label": "p-1.5 text-sm gap-1.5",
        "item": "p-1.5 text-sm gap-1.5",
        "itemLeadingIcon": "size-5",
        "itemLeadingAvatarSize": "2xs",
        "itemTrailingIcon": "size-5",
        "itemTrailingKbds": "gap-0.5",
        "itemTrailingKbdsSize": "md"
      },
      "lg": {
        "label": "p-2 text-sm gap-2",
        "item": "p-2 text-sm gap-2",
        "itemLeadingIcon": "size-5",
        "itemLeadingAvatarSize": "2xs",
        "itemTrailingIcon": "size-5",
        "itemTrailingKbds": "gap-1",
        "itemTrailingKbdsSize": "md"
      },
      "xl": {
        "label": "p-2 text-base gap-2",
        "item": "p-2 text-base gap-2",
        "itemLeadingIcon": "size-6",
        "itemLeadingAvatarSize": "xs",
        "itemTrailingIcon": "size-6",
        "itemTrailingKbds": "gap-1",
        "itemTrailingKbdsSize": "lg"
      }
    }
  },
  "compoundVariants": [
    {
      "color": "primary" as typeof color[number],
      "active": false,
      "class": {
        "item": "text-primary data-highlighted:text-primary data-highlighted:before:bg-primary/10 data-[state=open]:before:bg-primary/10",
        "itemLeadingIcon": "text-primary/75 group-data-highlighted:text-primary group-data-[state=open]:text-primary"
      }
    },
    {
      "color": "indigo" as typeof color[number],
      "active": false,
      "class": {
        "item": "text-indigo data-highlighted:text-indigo data-highlighted:before:bg-indigo/10 data-[state=open]:before:bg-indigo/10",
        "itemLeadingIcon": "text-indigo/75 group-data-highlighted:text-indigo group-data-[state=open]:text-indigo"
      }
    },
    {
      "color": "emerald" as typeof color[number],
      "active": false,
      "class": {
        "item": "text-emerald data-highlighted:text-emerald data-highlighted:before:bg-emerald/10 data-[state=open]:before:bg-emerald/10",
        "itemLeadingIcon": "text-emerald/75 group-data-highlighted:text-emerald group-data-[state=open]:text-emerald"
      }
    },
    {
      "color": "amber" as typeof color[number],
      "active": false,
      "class": {
        "item": "text-amber data-highlighted:text-amber data-highlighted:before:bg-amber/10 data-[state=open]:before:bg-amber/10",
        "itemLeadingIcon": "text-amber/75 group-data-highlighted:text-amber group-data-[state=open]:text-amber"
      }
    },
    {
      "color": "purple" as typeof color[number],
      "active": false,
      "class": {
        "item": "text-purple data-highlighted:text-purple data-highlighted:before:bg-purple/10 data-[state=open]:before:bg-purple/10",
        "itemLeadingIcon": "text-purple/75 group-data-highlighted:text-purple group-data-[state=open]:text-purple"
      }
    },
    {
      "color": "primary" as typeof color[number],
      "active": true,
      "class": {
        "item": "text-primary before:bg-primary/10",
        "itemLeadingIcon": "text-primary"
      }
    },
    {
      "color": "indigo" as typeof color[number],
      "active": true,
      "class": {
        "item": "text-indigo before:bg-indigo/10",
        "itemLeadingIcon": "text-indigo"
      }
    },
    {
      "color": "emerald" as typeof color[number],
      "active": true,
      "class": {
        "item": "text-emerald before:bg-emerald/10",
        "itemLeadingIcon": "text-emerald"
      }
    },
    {
      "color": "amber" as typeof color[number],
      "active": true,
      "class": {
        "item": "text-amber before:bg-amber/10",
        "itemLeadingIcon": "text-amber"
      }
    },
    {
      "color": "purple" as typeof color[number],
      "active": true,
      "class": {
        "item": "text-purple before:bg-purple/10",
        "itemLeadingIcon": "text-purple"
      }
    }
  ],
  "defaultVariants": {
    "size": "md" as typeof size[number]
  }
}