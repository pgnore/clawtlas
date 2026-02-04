const size = [
  "xs",
  "sm",
  "md",
  "lg",
  "xl"
] as const

const variant = [
  "outline",
  "soft",
  "subtle",
  "ghost",
  "none"
] as const

const color = [
  "primary",
  "indigo",
  "emerald",
  "amber",
  "purple",
  "neutral"
] as const

export default {
  "slots": {
    "root": "relative inline-flex items-center gap-1.5",
    "base": [
      "rounded-md border-0 placeholder:text-dimmed text-center focus:outline-none disabled:cursor-not-allowed disabled:opacity-75",
      "transition-colors"
    ]
  },
  "variants": {
    "size": {
      "xs": {
        "base": "size-6 text-xs"
      },
      "sm": {
        "base": "size-7 text-xs"
      },
      "md": {
        "base": "size-8 text-sm"
      },
      "lg": {
        "base": "size-9 text-sm"
      },
      "xl": {
        "base": "size-10 text-base"
      }
    },
    "variant": {
      "outline": "text-highlighted bg-default ring ring-inset ring-accented",
      "soft": "text-highlighted bg-elevated/50 hover:bg-elevated focus:bg-elevated disabled:bg-elevated/50",
      "subtle": "text-highlighted bg-elevated ring ring-inset ring-accented",
      "ghost": "text-highlighted bg-transparent hover:bg-elevated focus:bg-elevated disabled:bg-transparent dark:disabled:bg-transparent",
      "none": "text-highlighted bg-transparent"
    },
    "color": {
      "primary": "",
      "indigo": "",
      "emerald": "",
      "amber": "",
      "purple": "",
      "neutral": ""
    },
    "highlight": {
      "true": ""
    }
  },
  "compoundVariants": [
    {
      "color": "primary" as typeof color[number],
      "variant": [
        "outline" as typeof variant[number],
        "subtle" as typeof variant[number]
      ],
      "class": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
    },
    {
      "color": "indigo" as typeof color[number],
      "variant": [
        "outline" as typeof variant[number],
        "subtle" as typeof variant[number]
      ],
      "class": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": [
        "outline" as typeof variant[number],
        "subtle" as typeof variant[number]
      ],
      "class": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": [
        "outline" as typeof variant[number],
        "subtle" as typeof variant[number]
      ],
      "class": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": [
        "outline" as typeof variant[number],
        "subtle" as typeof variant[number]
      ],
      "class": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple"
    },
    {
      "color": "primary" as typeof color[number],
      "highlight": true,
      "class": "ring ring-inset ring-primary"
    },
    {
      "color": "indigo" as typeof color[number],
      "highlight": true,
      "class": "ring ring-inset ring-indigo"
    },
    {
      "color": "emerald" as typeof color[number],
      "highlight": true,
      "class": "ring ring-inset ring-emerald"
    },
    {
      "color": "amber" as typeof color[number],
      "highlight": true,
      "class": "ring ring-inset ring-amber"
    },
    {
      "color": "purple" as typeof color[number],
      "highlight": true,
      "class": "ring ring-inset ring-purple"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": [
        "outline" as typeof variant[number],
        "subtle" as typeof variant[number]
      ],
      "class": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-inverted"
    },
    {
      "color": "neutral" as typeof color[number],
      "highlight": true,
      "class": "ring ring-inset ring-inverted"
    }
  ],
  "defaultVariants": {
    "size": "md" as typeof size[number],
    "color": "primary" as typeof color[number],
    "variant": "outline" as typeof variant[number]
  }
}