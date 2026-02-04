const color = [
  "primary",
  "indigo",
  "emerald",
  "amber",
  "purple",
  "neutral"
] as const

const variant = [
  "solid",
  "outline",
  "soft",
  "subtle",
  "ghost",
  "link"
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
    "base": [
      "rounded-md font-medium inline-flex items-center disabled:cursor-not-allowed aria-disabled:cursor-not-allowed disabled:opacity-75 aria-disabled:opacity-75",
      "transition-colors"
    ],
    "label": "truncate",
    "leadingIcon": "shrink-0",
    "leadingAvatar": "shrink-0",
    "leadingAvatarSize": "",
    "trailingIcon": "shrink-0"
  },
  "variants": {
    "fieldGroup": {
      "horizontal": "not-only:first:rounded-e-none not-only:last:rounded-s-none not-last:not-first:rounded-none focus-visible:z-[1]",
      "vertical": "not-only:first:rounded-b-none not-only:last:rounded-t-none not-last:not-first:rounded-none focus-visible:z-[1]"
    },
    "color": {
      "primary": "",
      "indigo": "",
      "emerald": "",
      "amber": "",
      "purple": "",
      "neutral": ""
    },
    "variant": {
      "solid": "",
      "outline": "",
      "soft": "",
      "subtle": "",
      "ghost": "",
      "link": ""
    },
    "size": {
      "xs": {
        "base": "px-2 py-1 text-xs gap-1",
        "leadingIcon": "size-4",
        "leadingAvatarSize": "3xs",
        "trailingIcon": "size-4"
      },
      "sm": {
        "base": "px-2.5 py-1.5 text-xs gap-1.5",
        "leadingIcon": "size-4",
        "leadingAvatarSize": "3xs",
        "trailingIcon": "size-4"
      },
      "md": {
        "base": "px-2.5 py-1.5 text-sm gap-1.5",
        "leadingIcon": "size-5",
        "leadingAvatarSize": "2xs",
        "trailingIcon": "size-5"
      },
      "lg": {
        "base": "px-3 py-2 text-sm gap-2",
        "leadingIcon": "size-5",
        "leadingAvatarSize": "2xs",
        "trailingIcon": "size-5"
      },
      "xl": {
        "base": "px-3 py-2 text-base gap-2",
        "leadingIcon": "size-6",
        "leadingAvatarSize": "xs",
        "trailingIcon": "size-6"
      }
    },
    "block": {
      "true": {
        "base": "w-full justify-center",
        "trailingIcon": "ms-auto"
      }
    },
    "square": {
      "true": ""
    },
    "leading": {
      "true": ""
    },
    "trailing": {
      "true": ""
    },
    "loading": {
      "true": ""
    },
    "active": {
      "true": {
        "base": ""
      },
      "false": {
        "base": ""
      }
    }
  },
  "compoundVariants": [
    {
      "color": "primary" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-primary hover:bg-primary/75 active:bg-primary/75 disabled:bg-primary aria-disabled:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    },
    {
      "color": "indigo" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-indigo hover:bg-indigo/75 active:bg-indigo/75 disabled:bg-indigo aria-disabled:bg-indigo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-emerald hover:bg-emerald/75 active:bg-emerald/75 disabled:bg-emerald aria-disabled:bg-emerald focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-amber hover:bg-amber/75 active:bg-amber/75 disabled:bg-amber aria-disabled:bg-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-purple hover:bg-purple/75 active:bg-purple/75 disabled:bg-purple aria-disabled:bg-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple"
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-primary/50 text-primary hover:bg-primary/10 active:bg-primary/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    },
    {
      "color": "indigo" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-indigo/50 text-indigo hover:bg-indigo/10 active:bg-indigo/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-emerald/50 text-emerald hover:bg-emerald/10 active:bg-emerald/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-amber/50 text-amber hover:bg-amber/10 active:bg-amber/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-amber"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-purple/50 text-purple hover:bg-purple/10 active:bg-purple/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-purple"
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-primary bg-primary/10 hover:bg-primary/15 active:bg-primary/15 focus:outline-none focus-visible:bg-primary/15 disabled:bg-primary/10 aria-disabled:bg-primary/10"
    },
    {
      "color": "indigo" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-indigo bg-indigo/10 hover:bg-indigo/15 active:bg-indigo/15 focus:outline-none focus-visible:bg-indigo/15 disabled:bg-indigo/10 aria-disabled:bg-indigo/10"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-emerald bg-emerald/10 hover:bg-emerald/15 active:bg-emerald/15 focus:outline-none focus-visible:bg-emerald/15 disabled:bg-emerald/10 aria-disabled:bg-emerald/10"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-amber bg-amber/10 hover:bg-amber/15 active:bg-amber/15 focus:outline-none focus-visible:bg-amber/15 disabled:bg-amber/10 aria-disabled:bg-amber/10"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-purple bg-purple/10 hover:bg-purple/15 active:bg-purple/15 focus:outline-none focus-visible:bg-purple/15 disabled:bg-purple/10 aria-disabled:bg-purple/10"
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-primary ring ring-inset ring-primary/25 bg-primary/10 hover:bg-primary/15 active:bg-primary/15 disabled:bg-primary/10 aria-disabled:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    },
    {
      "color": "indigo" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-indigo ring ring-inset ring-indigo/25 bg-indigo/10 hover:bg-indigo/15 active:bg-indigo/15 disabled:bg-indigo/10 aria-disabled:bg-indigo/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-emerald ring ring-inset ring-emerald/25 bg-emerald/10 hover:bg-emerald/15 active:bg-emerald/15 disabled:bg-emerald/10 aria-disabled:bg-emerald/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-amber ring ring-inset ring-amber/25 bg-amber/10 hover:bg-amber/15 active:bg-amber/15 disabled:bg-amber/10 aria-disabled:bg-amber/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-purple ring ring-inset ring-purple/25 bg-purple/10 hover:bg-purple/15 active:bg-purple/15 disabled:bg-purple/10 aria-disabled:bg-purple/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple"
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "ghost" as typeof variant[number],
      "class": "text-primary hover:bg-primary/10 active:bg-primary/10 focus:outline-none focus-visible:bg-primary/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent"
    },
    {
      "color": "indigo" as typeof color[number],
      "variant": "ghost" as typeof variant[number],
      "class": "text-indigo hover:bg-indigo/10 active:bg-indigo/10 focus:outline-none focus-visible:bg-indigo/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "ghost" as typeof variant[number],
      "class": "text-emerald hover:bg-emerald/10 active:bg-emerald/10 focus:outline-none focus-visible:bg-emerald/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "ghost" as typeof variant[number],
      "class": "text-amber hover:bg-amber/10 active:bg-amber/10 focus:outline-none focus-visible:bg-amber/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "ghost" as typeof variant[number],
      "class": "text-purple hover:bg-purple/10 active:bg-purple/10 focus:outline-none focus-visible:bg-purple/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent"
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": "text-primary hover:text-primary/75 active:text-primary/75 disabled:text-primary aria-disabled:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
    },
    {
      "color": "indigo" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": "text-indigo hover:text-indigo/75 active:text-indigo/75 disabled:text-indigo aria-disabled:text-indigo focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": "text-emerald hover:text-emerald/75 active:text-emerald/75 disabled:text-emerald aria-disabled:text-emerald focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": "text-amber hover:text-amber/75 active:text-amber/75 disabled:text-amber aria-disabled:text-amber focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": "text-purple hover:text-purple/75 active:text-purple/75 disabled:text-purple aria-disabled:text-purple focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-inverted hover:bg-inverted/90 active:bg-inverted/90 disabled:bg-inverted aria-disabled:bg-inverted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inverted"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-accented text-default bg-default hover:bg-elevated active:bg-elevated disabled:bg-default aria-disabled:bg-default focus:outline-none focus-visible:ring-2 focus-visible:ring-inverted"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-default bg-elevated hover:bg-accented/75 active:bg-accented/75 focus:outline-none focus-visible:bg-accented/75 disabled:bg-elevated aria-disabled:bg-elevated"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "ring ring-inset ring-accented text-default bg-elevated hover:bg-accented/75 active:bg-accented/75 disabled:bg-elevated aria-disabled:bg-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-inverted"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "ghost" as typeof variant[number],
      "class": "text-default hover:bg-elevated active:bg-elevated focus:outline-none focus-visible:bg-elevated hover:disabled:bg-transparent dark:hover:disabled:bg-transparent hover:aria-disabled:bg-transparent dark:hover:aria-disabled:bg-transparent"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": "text-muted hover:text-default active:text-default disabled:text-muted aria-disabled:text-muted focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-inverted"
    },
    {
      "size": "xs" as typeof size[number],
      "square": true,
      "class": "p-1"
    },
    {
      "size": "sm" as typeof size[number],
      "square": true,
      "class": "p-1.5"
    },
    {
      "size": "md" as typeof size[number],
      "square": true,
      "class": "p-1.5"
    },
    {
      "size": "lg" as typeof size[number],
      "square": true,
      "class": "p-2"
    },
    {
      "size": "xl" as typeof size[number],
      "square": true,
      "class": "p-2"
    },
    {
      "loading": true,
      "leading": true,
      "class": {
        "leadingIcon": "animate-spin"
      }
    },
    {
      "loading": true,
      "leading": false,
      "trailing": true,
      "class": {
        "trailingIcon": "animate-spin"
      }
    }
  ],
  "defaultVariants": {
    "color": "primary" as typeof color[number],
    "variant": "solid" as typeof variant[number],
    "size": "md" as typeof size[number]
  }
}