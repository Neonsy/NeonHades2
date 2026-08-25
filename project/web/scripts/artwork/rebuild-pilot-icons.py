from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "art-source" / "vector" / "reconstructed"


BORN_GAIN = """<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="0 0 512 512" role="img" aria-labelledby="born-gain-title born-gain-description">
  <title id="born-gain-title">Born Gain peacock-vortex boon</title>
  <desc id="born-gain-description">A smooth reconstruction of Hera's Born Gain icon: peacock-colored feathers spiral around a gold divine seal.</desc>
  <defs>
    <linearGradient id="born-frame" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#171429"/><stop offset=".55" stop-color="#080b16"/><stop offset="1" stop-color="#092d42"/></linearGradient>
    <radialGradient id="born-depth" cx="50%" cy="47%" r="58%"><stop stop-color="#26367b"/><stop offset=".55" stop-color="#171a55"/><stop offset="1" stop-color="#070912"/></radialGradient>
    <linearGradient id="born-cyan" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b7fff4"/><stop offset=".45" stop-color="#49e0d5"/><stop offset="1" stop-color="#087caa"/></linearGradient>
    <linearGradient id="born-violet" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b7a0ff"/><stop offset=".5" stop-color="#7957ec"/><stop offset="1" stop-color="#35217c"/></linearGradient>
    <linearGradient id="born-gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff0a5"/><stop offset=".42" stop-color="#f1bd4f"/><stop offset="1" stop-color="#8e5917"/></linearGradient>
    <filter id="born-shadow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur"/><feOffset dy="10" result="off"/><feColorMatrix in="off" values="0 0 0 0 0 0 0 0 0 0.02 0 0 0 0 0.06 0 0 0 .72 0"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <g inkscape:groupmode="layer" inkscape:label="Divine frame" id="born-frame-layer" filter="url(#born-shadow)">
    <path d="M112 35H400Q463 35 477 99L489 173Q499 230 489 286L477 413Q468 477 400 477H112Q44 477 35 413L23 286Q13 230 23 173L35 99Q49 35 112 35Z" fill="url(#born-frame)" stroke="#060810" stroke-width="22"/>
    <path d="M113 62H399Q434 62 447 99L462 183Q469 229 461 278L447 402Q440 445 399 449H113Q72 445 65 402L51 278Q43 229 50 183L65 99Q78 62 113 62Z" fill="url(#born-depth)" stroke="#2c3163" stroke-width="7"/>
    <path d="M85 86Q256 40 427 86" fill="none" stroke="#63e6d2" stroke-width="4" opacity=".42"/>
  </g>
  <g inkscape:groupmode="layer" inkscape:label="Peacock vortex" id="born-vortex">
    <path d="M258 81C332 68 407 103 436 164C375 142 328 151 290 188C300 137 286 106 258 81Z" fill="url(#born-violet)" stroke="#050710" stroke-width="13"/>
    <path d="M431 169C470 232 460 319 413 370C402 307 376 267 324 245C376 232 411 206 431 169Z" fill="url(#born-cyan)" stroke="#050710" stroke-width="13"/>
    <path d="M408 374C359 433 274 453 213 425C273 402 306 370 318 314C343 363 371 382 408 374Z" fill="url(#born-violet)" stroke="#050710" stroke-width="13"/>
    <path d="M207 426C135 418 73 362 65 296C116 336 163 344 213 319C186 363 184 397 207 426Z" fill="url(#born-cyan)" stroke="#050710" stroke-width="13"/>
    <path d="M63 289C48 221 82 141 143 106C122 168 132 216 173 256C122 244 89 255 63 289Z" fill="url(#born-violet)" stroke="#050710" stroke-width="13"/>
    <path d="M149 103C190 72 235 66 268 80C221 107 198 143 200 194C169 154 143 129 149 103Z" fill="url(#born-cyan)" stroke="#050710" stroke-width="13"/>
    <path d="M280 106C333 97 384 119 410 155C364 143 326 158 296 196" fill="none" stroke="#b7fff4" stroke-width="7" stroke-linecap="round" opacity=".72"/>
    <path d="M425 199C441 252 428 309 395 342" fill="none" stroke="#8da5ff" stroke-width="7" stroke-linecap="round" opacity=".62"/>
    <path d="M378 392C330 424 271 430 230 412" fill="none" stroke="#b7fff4" stroke-width="7" stroke-linecap="round" opacity=".68"/>
    <path d="M158 397C111 372 79 326 78 281" fill="none" stroke="#8da5ff" stroke-width="7" stroke-linecap="round" opacity=".62"/>
    <path d="M84 237C91 179 122 133 164 109" fill="none" stroke="#b7fff4" stroke-width="7" stroke-linecap="round" opacity=".65"/>
  </g>
  <g inkscape:groupmode="layer" inkscape:label="Central Hera seal" id="born-seal">
    <path d="M256 157L345 210L330 316L256 369L182 316L167 210Z" fill="#080b16" stroke="#050710" stroke-width="15"/>
    <path d="M256 173L327 219L314 304L256 350L198 304L185 219Z" fill="url(#born-gold)" stroke="#f6dd82" stroke-width="5"/>
    <path d="M256 194L306 224L296 286L256 326L216 286L206 224Z" fill="#142138" stroke="#74511e" stroke-width="8"/>
    <path d="M256 211L293 237L281 281L256 309L231 281L219 237Z" fill="url(#born-cyan)" stroke="#050710" stroke-width="8"/>
    <path d="M256 225L277 243L270 273L256 290L242 273L235 243Z" fill="#fff5bf"/>
    <circle cx="256" cy="256" r="10" fill="#8d5aec" stroke="#070911" stroke-width="5"/>
    <path d="M256 160V132M330 210L357 194M330 316L354 336M182 316L158 336M182 210L155 194" fill="none" stroke="#f2bd57" stroke-width="10" stroke-linecap="round"/>
  </g>
</svg>
"""


NOVA_STRIKE = """<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="0 0 512 512" role="img" aria-labelledby="nova-strike-title nova-strike-description">
  <title id="nova-strike-title">Nova Strike solar-scroll boon</title>
  <desc id="nova-strike-description">A smooth reconstruction of Apollo's Nova Strike icon: a radiant gold scroll crosses a dark solar plaque.</desc>
  <defs>
    <linearGradient id="nova-frame" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#38270a"/><stop offset=".5" stop-color="#0d0b08"/><stop offset="1" stop-color="#6c430b"/></linearGradient>
    <linearGradient id="nova-gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff3a8"/><stop offset=".42" stop-color="#f3c04f"/><stop offset="1" stop-color="#a65d0c"/></linearGradient>
    <linearGradient id="nova-paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff8cf"/><stop offset=".58" stop-color="#f4dc89"/><stop offset="1" stop-color="#b87a22"/></linearGradient>
    <linearGradient id="nova-cyan" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#d4fff6"/><stop offset=".5" stop-color="#52e1d6"/><stop offset="1" stop-color="#178da3"/></linearGradient>
    <filter id="nova-shadow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur"/><feOffset dy="10" result="off"/><feColorMatrix in="off" values="0 0 0 0 0 0 0 0 0 0.015 0 0 0 0 0.035 0 0 0 .75 0"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <g inkscape:groupmode="layer" inkscape:label="Solar plaque" id="nova-plaque" filter="url(#nova-shadow)">
    <path d="M107 42H405Q458 42 472 95L489 164Q500 216 486 278L468 415Q459 471 402 478H110Q53 471 44 415L26 278Q12 216 23 164L40 95Q54 42 107 42Z" fill="url(#nova-frame)" stroke="#06070b" stroke-width="24"/>
    <path d="M113 72H399Q428 72 439 105L457 174Q465 216 455 265L438 397Q432 438 395 444H117Q80 438 74 397L57 265Q47 216 55 174L73 105Q84 72 113 72Z" fill="#1a1309" stroke="#8f641b" stroke-width="6"/>
    <path d="M90 109Q256 63 422 109" fill="none" stroke="#f5c760" stroke-width="6" opacity=".46"/>
  </g>
  <g inkscape:groupmode="layer" inkscape:label="Radiant scroll" id="nova-scroll">
    <path d="M121 138C168 105 218 98 268 112C227 129 204 155 198 189C230 166 275 158 315 166C361 174 395 202 405 238C367 212 333 204 295 210C337 232 365 263 368 301C330 274 287 265 244 278C293 290 326 317 337 353C287 331 239 335 195 364C161 386 131 387 106 374C140 362 167 343 188 317C151 330 112 325 86 303C127 297 157 280 178 255C140 260 104 246 84 220C126 217 161 199 183 171C152 174 130 162 121 138Z" fill="url(#nova-paper)" stroke="#08090c" stroke-width="15" stroke-linejoin="round"/>
    <path d="M120 138C146 144 168 142 183 128C183 157 196 174 217 181" fill="none" stroke="#fff6ca" stroke-width="17" stroke-linecap="round"/>
    <path d="M404 238C380 242 362 255 353 275C347 245 331 224 306 211" fill="none" stroke="#f7e4a1" stroke-width="15" stroke-linecap="round"/>
    <path d="M108 374C141 382 169 371 195 349C224 325 260 314 298 317" fill="none" stroke="#9c651d" stroke-width="13" stroke-linecap="round" opacity=".78"/>
    <path d="M150 233C198 209 253 198 314 204" fill="none" stroke="#d39c2f" stroke-width="8" stroke-linecap="round"/>
    <path d="M128 282C177 286 224 276 267 253" fill="none" stroke="#f8e2a2" stroke-width="7" stroke-linecap="round" opacity=".82"/>
    <path d="M180 347C224 325 274 320 319 338" fill="none" stroke="#e6b750" stroke-width="7" stroke-linecap="round"/>
  </g>
  <g inkscape:groupmode="layer" inkscape:label="Apollo marks" id="nova-marks">
    <path d="M132 357C186 379 264 375 332 339" fill="none" stroke="url(#nova-cyan)" stroke-width="12" stroke-linecap="round"/>
    <path d="M158 364L168 345M205 374L212 351M252 370L257 345M298 358L300 337" fill="none" stroke="#6ce8da" stroke-width="6" stroke-linecap="round"/>
    <path d="M328 122L349 91M352 136L384 112M369 162L407 151" fill="none" stroke="#f2bd57" stroke-width="10" stroke-linecap="round"/>
    <path d="M91 207C77 180 83 150 104 127" fill="none" stroke="#bcfff4" stroke-width="7" stroke-linecap="round" opacity=".8"/>
  </g>
</svg>
"""


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "born-gain.svg").write_text(BORN_GAIN, encoding="utf-8")
    (OUTPUT / "nova-strike.svg").write_text(NOVA_STRIKE, encoding="utf-8")
    print("Rebuilt 2 smooth pilot icon masters")


if __name__ == "__main__":
    main()
