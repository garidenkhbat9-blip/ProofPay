import Image from "next/image";
import Link from "next/link";

/** One lockup everywhere. The source PNG includes transparent optical padding. */
export function BrandContents() {
  return (
    <>
      <span className="pp-brand-icon">
        <Image src="/logo.png" alt="" width={48} height={48} />
      </span>
      <span className="pp-brand-name">ProofPay</span>
    </>
  );
}

export function Brand({
  href = "/",
  onClick,
}: {
  href?: string;
  onClick?: () => void;
}) {
  return (
    <Link className="brand pp-brand" href={href} onClick={onClick}>
      <BrandContents />
    </Link>
  );
}
