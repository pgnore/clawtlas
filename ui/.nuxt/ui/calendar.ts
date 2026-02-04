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

const size = [
  "xs",
  "sm",
  "md",
  "lg",
  "xl"
] as const

export default {
  "slots": {
    "root": "",
    "header": "flex items-center justify-between",
    "body": "flex flex-col space-y-4 pt-4 sm:flex-row sm:space-x-4 sm:space-y-0",
    "heading": "text-center font-medium truncate mx-auto",
    "grid": "w-full border-collapse select-none space-y-1 focus:outline-none",
    "gridRow": "grid grid-cols-7 place-items-center",
    "gridWeekDaysRow": "mb-1 grid w-full grid-cols-7",
    "gridBody": "grid",
    "headCell": "rounded-md",
    "headCellWeek": "rounded-md text-muted",
    "cell": "relative text-center",
    "cellTrigger": [
      "m-0.5 relative flex items-center justify-center rounded-full whitespace-nowrap focus-visible:ring-2 focus:outline-none data-disabled:text-muted data-unavailable:line-through data-unavailable:text-muted data-unavailable:pointer-events-none data-today:font-semibold data-[outside-view]:text-muted",
      "transition"
    ],
    "cellWeek": "relative text-center text-muted"
  },
  "variants": {
    "color": {
      "primary": {
        "headCell": "text-primary",
        "cellTrigger": "focus-visible:ring-primary"
      },
      "indigo": {
        "headCell": "text-indigo",
        "cellTrigger": "focus-visible:ring-indigo"
      },
      "emerald": {
        "headCell": "text-emerald",
        "cellTrigger": "focus-visible:ring-emerald"
      },
      "amber": {
        "headCell": "text-amber",
        "cellTrigger": "focus-visible:ring-amber"
      },
      "purple": {
        "headCell": "text-purple",
        "cellTrigger": "focus-visible:ring-purple"
      },
      "neutral": {
        "headCell": "text-highlighted",
        "cellTrigger": "focus-visible:ring-inverted"
      }
    },
    "variant": {
      "solid": "",
      "outline": "",
      "soft": "",
      "subtle": ""
    },
    "size": {
      "xs": {
        "heading": "text-xs",
        "cell": "text-xs",
        "cellWeek": "text-xs",
        "headCell": "text-[10px]",
        "headCellWeek": "text-[10px]",
        "cellTrigger": "size-7",
        "body": "space-y-2 pt-2"
      },
      "sm": {
        "heading": "text-xs",
        "headCell": "text-xs",
        "headCellWeek": "text-xs",
        "cellWeek": "text-xs",
        "cell": "text-xs",
        "cellTrigger": "size-7"
      },
      "md": {
        "heading": "text-sm",
        "headCell": "text-xs",
        "headCellWeek": "text-xs",
        "cellWeek": "text-xs",
        "cell": "text-sm",
        "cellTrigger": "size-8"
      },
      "lg": {
        "heading": "text-md",
        "headCell": "text-md",
        "headCellWeek": "text-md",
        "cellTrigger": "size-9 text-md"
      },
      "xl": {
        "heading": "text-lg",
        "headCell": "text-lg",
        "headCellWeek": "text-lg",
        "cellTrigger": "size-10 text-lg"
      }
    },
    "weekNumbers": {
      "true": {
        "gridRow": "grid-cols-8",
        "gridWeekDaysRow": "grid-cols-8 [&>*:first-child]:col-start-2"
      }
    }
  },
  "compoundVariants": [
    {
      "color": "primary" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-primary data-[selected]:text-inverted data-today:not-data-[selected]:text-primary data-[highlighted]:bg-primary/20 hover:not-data-[selected]:bg-primary/20"
      }
    },
    {
      "color": "indigo" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-indigo data-[selected]:text-inverted data-today:not-data-[selected]:text-indigo data-[highlighted]:bg-indigo/20 hover:not-data-[selected]:bg-indigo/20"
      }
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-emerald data-[selected]:text-inverted data-today:not-data-[selected]:text-emerald data-[highlighted]:bg-emerald/20 hover:not-data-[selected]:bg-emerald/20"
      }
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-amber data-[selected]:text-inverted data-today:not-data-[selected]:text-amber data-[highlighted]:bg-amber/20 hover:not-data-[selected]:bg-amber/20"
      }
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-purple data-[selected]:text-inverted data-today:not-data-[selected]:text-purple data-[highlighted]:bg-purple/20 hover:not-data-[selected]:bg-purple/20"
      }
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-primary/50 data-[selected]:text-primary data-today:not-data-[selected]:text-primary data-[highlighted]:bg-primary/10 hover:not-data-[selected]:bg-primary/10"
      }
    },
    {
      "color": "indigo" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-indigo/50 data-[selected]:text-indigo data-today:not-data-[selected]:text-indigo data-[highlighted]:bg-indigo/10 hover:not-data-[selected]:bg-indigo/10"
      }
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-emerald/50 data-[selected]:text-emerald data-today:not-data-[selected]:text-emerald data-[highlighted]:bg-emerald/10 hover:not-data-[selected]:bg-emerald/10"
      }
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-amber/50 data-[selected]:text-amber data-today:not-data-[selected]:text-amber data-[highlighted]:bg-amber/10 hover:not-data-[selected]:bg-amber/10"
      }
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-purple/50 data-[selected]:text-purple data-today:not-data-[selected]:text-purple data-[highlighted]:bg-purple/10 hover:not-data-[selected]:bg-purple/10"
      }
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-primary/10 data-[selected]:text-primary data-today:not-data-[selected]:text-primary data-[highlighted]:bg-primary/20 hover:not-data-[selected]:bg-primary/20"
      }
    },
    {
      "color": "indigo" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-indigo/10 data-[selected]:text-indigo data-today:not-data-[selected]:text-indigo data-[highlighted]:bg-indigo/20 hover:not-data-[selected]:bg-indigo/20"
      }
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-emerald/10 data-[selected]:text-emerald data-today:not-data-[selected]:text-emerald data-[highlighted]:bg-emerald/20 hover:not-data-[selected]:bg-emerald/20"
      }
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-amber/10 data-[selected]:text-amber data-today:not-data-[selected]:text-amber data-[highlighted]:bg-amber/20 hover:not-data-[selected]:bg-amber/20"
      }
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-purple/10 data-[selected]:text-purple data-today:not-data-[selected]:text-purple data-[highlighted]:bg-purple/20 hover:not-data-[selected]:bg-purple/20"
      }
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-primary/10 data-[selected]:text-primary data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-primary/25 data-today:not-data-[selected]:text-primary data-[highlighted]:bg-primary/20 hover:not-data-[selected]:bg-primary/20"
      }
    },
    {
      "color": "indigo" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-indigo/10 data-[selected]:text-indigo data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-indigo/25 data-today:not-data-[selected]:text-indigo data-[highlighted]:bg-indigo/20 hover:not-data-[selected]:bg-indigo/20"
      }
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-emerald/10 data-[selected]:text-emerald data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-emerald/25 data-today:not-data-[selected]:text-emerald data-[highlighted]:bg-emerald/20 hover:not-data-[selected]:bg-emerald/20"
      }
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-amber/10 data-[selected]:text-amber data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-amber/25 data-today:not-data-[selected]:text-amber data-[highlighted]:bg-amber/20 hover:not-data-[selected]:bg-amber/20"
      }
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-purple/10 data-[selected]:text-purple data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-purple/25 data-today:not-data-[selected]:text-purple data-[highlighted]:bg-purple/20 hover:not-data-[selected]:bg-purple/20"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-inverted data-[selected]:text-inverted data-today:not-data-[selected]:text-highlighted data-[highlighted]:bg-inverted/20 hover:not-data-[selected]:bg-inverted/10"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-accented data-[selected]:text-default data-[selected]:bg-default data-today:not-data-[selected]:text-highlighted data-[highlighted]:bg-inverted/10 hover:not-data-[selected]:bg-inverted/10"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-elevated data-[selected]:text-default data-today:not-data-[selected]:text-highlighted data-[highlighted]:bg-inverted/20 hover:not-data-[selected]:bg-inverted/10"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-elevated data-[selected]:text-default data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-accented data-today:not-data-[selected]:text-highlighted data-[highlighted]:bg-inverted/20 hover:not-data-[selected]:bg-inverted/10"
      }
    }
  ],
  "defaultVariants": {
    "size": "md" as typeof size[number],
    "color": "primary" as typeof color[number],
    "variant": "solid" as typeof variant[number]
  }
}