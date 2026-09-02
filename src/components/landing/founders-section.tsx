import { User } from "lucide-react";
import { notoNastaliqUrdu, notoNaskhArabic } from "@/lib/fonts";
import { ScrollReveal } from "@/components/scroll-reveal";

const GOLD = "#C9A227";

/**
 * A tribute section for the farm's founder and the family legacy behind it
 * — sits between the Products section and the developer-credit footer.
 * Copy is fixed, approved text (see the chat thread this was drafted in),
 * not meant to be edited casually: the founder message, the ayat and its
 * translations, and the legacy narrative were all reviewed and signed off
 * on before this component was written.
 */
export function FoundersSection() {
  return (
    <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 sm:pb-24">
      <ScrollReveal>
        <div className="mb-8 flex flex-col items-center gap-2 text-center sm:mb-12">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: GOLD }}>
            Founded on trust
          </span>
          <h2 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">Our Story</h2>
        </div>
      </ScrollReveal>

      <ScrollReveal delayMs={80}>
        <div className="flex flex-col items-center gap-4 text-center">
          {/* Photo placeholder — swap for a real <Image> once one is provided. */}
          <div className="flex size-28 items-center justify-center rounded-full border-2 border-primary/20 bg-accent text-primary sm:size-32">
            <User className="size-12 sm:size-14" strokeWidth={1.5} />
          </div>
          <div>
            <p className="font-heading text-xl font-bold text-foreground sm:text-2xl">Muhammad Khalid Yaseen</p>
            <p className="text-sm text-muted-foreground">Founder, Bin Khalid Dairy Farm</p>
          </div>
          <p className="max-w-2xl text-base leading-relaxed text-foreground/90 sm:text-lg">
            For Muhammad Khalid Yaseen, a glass of milk was never just a product — it was a promise.
            Long before it became a business, it was a habit passed down through generations: give
            people what you would give your own family, nothing less, nothing hidden. That belief is
            the actual foundation Bin Khalid Dairy Farm stands on today — purity in what leaves the
            farm, and honesty in every account we keep.
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal delayMs={160}>
        <div
          className="my-10 flex flex-col items-center gap-5 rounded-2xl border border-border px-6 py-8 text-center sm:my-12 sm:px-10"
          style={{ backgroundColor: "rgba(27, 67, 50, 0.035)" }}
        >
          <p dir="rtl" className={`${notoNaskhArabic.className} text-2xl leading-loose text-foreground sm:text-3xl`}>
            فَإِنْ أَمِنَ بَعْضُكُم بَعْضًا فَلْيُؤَدِّ الَّذِي اؤْتُمِنَ أَمَانَتَهُ وَلْيَتَّقِ اللَّهَ رَبَّهُ
          </p>
          <p dir="rtl" className={`${notoNastaliqUrdu.className} max-w-xl text-lg text-foreground/80`}>
            پھر اگر تم میں سے ایک دوسرے پر اعتماد کرے تو جس پر اعتماد کیا گیا ہے وہ اپنی امانت ادا کر
            دے، اور اللہ سے ڈرے جو اس کا رب ہے۔
          </p>
          <p className="max-w-xl text-sm italic leading-relaxed text-muted-foreground sm:text-base">
            &ldquo;...And if one of you entrusts another, then let the one who is entrusted discharge
            his trust [faithfully], and let him fear Allah, his Lord...&rdquo;
          </p>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Surah Al-Baqarah, 2:283
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal delayMs={240}>
        <div className="flex flex-col gap-4 text-center">
          <p className="text-base leading-relaxed text-foreground/90 sm:text-lg">
            Muhammad Khalid Yaseen carried forward a legacy that began with his own parents — a life
            built on the land, on livestock raised with care, and on a name that was worth more than
            any contract. He founded Bin Khalid Dairy Farm not to start something new, but to
            continue something old: a family&apos;s word being its bond.
          </p>
          <p className="text-base leading-relaxed text-foreground/90 sm:text-lg">
            Today, that legacy continues through his sons —{" "}
            <span className="font-semibold text-foreground">Muhammad Ibrahim</span>,{" "}
            <span className="font-semibold text-foreground">Muhammad Faisal</span>, and{" "}
            <span className="font-semibold text-foreground">Muhammad Ismail</span> — who carry
            forward what their father and grandparents built before them: the same farm, the same
            milk, and the same principle that has never changed.
          </p>
        </div>
      </ScrollReveal>
    </section>
  );
}
