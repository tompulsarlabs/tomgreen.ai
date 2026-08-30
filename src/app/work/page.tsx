import { permanentRedirect } from "next/navigation";

/**
 * The operating record is the home page now. This route stays so every
 * link that ever pointed at /work — inbound, printed, indexed — still
 * lands on the content, and search engines are told once, permanently,
 * where it moved. The case studies at /work/[slug] are untouched.
 */
export default function WorkIndexRedirect() {
  permanentRedirect("/");
}
