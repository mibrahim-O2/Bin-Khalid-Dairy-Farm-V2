import Image from "next/image";
import { notoNastaliqUrdu } from "@/lib/fonts";
import { ScrollReveal } from "@/components/scroll-reveal";

const PRODUCTS = [
  { key: "milk", name: "Milk", nameUrdu: "دودھ", image: "/products/milk.png" },
  { key: "ghee", name: "Ghee", nameUrdu: "گھی", image: "/products/ghee.png" },
  { key: "makhan", name: "Makhan", nameUrdu: "مکھن", image: "/products/makhan.png" },
  { key: "dahi", name: "Dahi", nameUrdu: "دہی", image: "/products/dahi.png" },
  { key: "lassi", name: "Lassi", nameUrdu: "لسی", image: "/products/lassi.png" },
  { key: "khoya", name: "Khoya", nameUrdu: "کھویا", image: "/products/khoya.png" },
] as const;

export function ProductsShowcase() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
      {PRODUCTS.map((product, index) => (
        <ScrollReveal key={product.key} delayMs={index * 60}>
          <div className="group flex flex-col items-center gap-3 rounded-3xl border border-border bg-card p-5 text-center shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-lg sm:p-6">
            <div className="relative flex h-24 w-24 items-center justify-center sm:h-32 sm:w-32">
              <Image
                src={product.image}
                alt={product.name}
                width={512}
                height={512}
                className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <div>
              <p className="font-heading text-base font-bold text-foreground sm:text-lg">{product.name}</p>
              <p dir="rtl" className={`${notoNastaliqUrdu.className} text-sm text-muted-foreground`}>
                {product.nameUrdu}
              </p>
            </div>
          </div>
        </ScrollReveal>
      ))}
    </div>
  );
}
