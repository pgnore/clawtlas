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
  "subtle"
] as const

export default {
  "slots": {
    "root": "relative overflow-hidden w-full rounded-lg p-4 flex gap-2.5",
    "wrapper": "min-w-0 flex-1 flex flex-col",
    "title": "text-sm font-medium",
    "description": "text-sm opacity-90",
    "icon": "shrink-0 size-5",
    "avatar": "shrink-0",
    "avatarSize": "2xl",
    "actions": "flex flex-wrap gap-1.5 shrink-0",
    "close": "p-0"
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
    "variant": {
      "solid": "",
      "outline": "",
      "soft": "",
      "subtle": ""
    },
    "orientation": {
      "horizontal": {
        "root": "items-center",
        "actions": "items-center"
      },
      "vertical": {
        "root": "items-start",
        "actions": "items-start mt-2.5"
      }
    },
    "title": {
      "true": {
        "description": "mt-1"
      }
    }
  },
  "compoundVariants": [
    {
      "color": "primary" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "root": "bg-primary text-inverted"
      }
    },
    {
      "color": "indigo" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "root": "bg-indigo text-inverted"
      }
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "root": "bg-emerald text-inverted"
      }
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "root": "bg-amber text-inverted"
      }
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "root": "bg-purple text-inverted"
      }
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "root": "text-primary ring ring-inset ring-primary/25"
      }
    },
    {
      "color": "indigo" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "root": "text-indigo ring ring-inset ring-indigo/25"
      }
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "root": "text-emerald ring ring-inset ring-emerald/25"
      }
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "root": "text-amber ring ring-inset ring-amber/25"
      }
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "root": "text-purple ring ring-inset ring-purple/25"
      }
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "root": "bg-primary/10 text-primary"
      }
    },
    {
      "color": "indigo" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "root": "bg-indigo/10 text-indigo"
      }
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "root": "bg-emerald/10 text-emerald"
      }
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "root": "bg-amber/10 text-amber"
      }
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "root": "bg-purple/10 text-purple"
      }
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "root": "bg-primary/10 text-primary ring ring-inset ring-primary/25"
      }
    },
    {
      "color": "indigo" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "root": "bg-indigo/10 text-indigo ring ring-inset ring-indigo/25"
      }
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "root": "bg-emerald/10 text-emerald ring ring-inset ring-emerald/25"
      }
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "root": "bg-amber/10 text-amber ring ring-inset ring-amber/25"
      }
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "root": "bg-purple/10 text-purple ring ring-inset ring-purple/25"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "root": "text-inverted bg-inverted"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "root": "text-highlighted bg-default ring ring-inset ring-default"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "root": "text-highlighted bg-elevated/50"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "root": "text-highlighted bg-elevated/50 ring ring-inset ring-accented"
      }
    }
  ],
  "defaultVariants": {
    "color": "primary" as typeof color[number],
    "variant": "solid" as typeof variant[number]
  }
}