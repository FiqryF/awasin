export function BrandMark() {
  return <span className="brand-mark" aria-hidden="true">
    <img className="brand-logo brand-logo-honeydew" src={`${import.meta.env.BASE_URL}assets/brand/logo-honeydew.png`} alt="" width={2000} height={2000} decoding="async" />
    <img className="brand-logo brand-logo-red" src={`${import.meta.env.BASE_URL}assets/brand/logo-blood-red.png`} alt="" width={2000} height={2000} decoding="async" />
  </span>
}
