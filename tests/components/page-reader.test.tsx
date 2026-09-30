import { afterEach, expect, it, vi } from "vitest";
import { readPage, speakText, stopReading, speechChunks, isPageSpeaking } from "../../src/lib/page-reader";
afterEach(() => { stopReading(); document.body.innerHTML = ""; });
it("reads main content in selected language without sending a key to the browser endpoint", async () => {
  document.body.innerHTML = '<nav>Menu</nav><main id="exam-main-content">यह प्रश्न है।</main>';
  const fetch = vi.fn().mockResolvedValue({ok:false,json:async()=>({error:"test failure"})}); vi.stubGlobal("fetch",fetch);
  readPage("hi"); await vi.waitFor(()=>expect(fetch).toHaveBeenCalled());
  const [url,options]=fetch.mock.calls[0]; expect(url).toBe("/api/tts"); expect(JSON.parse(options.body)).toEqual({text:"यह प्रश्न है।",language:"hi"}); expect(options.headers).not.toHaveProperty("api-subscription-key");
});
it("stops pending generation and never plays late audio", async () => {
  let finish:any; const fetch=vi.fn(()=>new Promise(resolve=>{finish=resolve;})); vi.stubGlobal("fetch",fetch); const audio=vi.fn(); vi.stubGlobal("Audio",audio);
  const pending=speakText("Hello","en"); expect(isPageSpeaking()).toBe(true); stopReading(); finish({ok:true,json:async()=>({audios:["UklGRg=="]})}); await pending; expect(audio).not.toHaveBeenCalled(); expect(isPageSpeaking()).toBe(false);
});
it("decodes audio and cleans playback URLs when stopped", async () => {
  const create=vi.fn(()=>"blob:test"); const revoke=vi.fn(); vi.spyOn(URL,"createObjectURL").mockImplementation(create); vi.spyOn(URL,"revokeObjectURL").mockImplementation(revoke);
  let audio:any; class Player { onended:any; onerror:any; onplaying:any; play=vi.fn(async()=>{}); pause=vi.fn(); load=vi.fn(); removeAttribute=vi.fn(); constructor(){audio=this;} }
  vi.stubGlobal("Audio",Player); vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({audios:["UklGRg=="]})}));
  const result=speakText("Hello","en"); await vi.waitFor(()=>expect(audio?.play).toHaveBeenCalled()); stopReading(); await result; expect(audio.pause).toHaveBeenCalled(); expect(revoke).toHaveBeenCalledWith("blob:test");
});
it("chunks long pages and reports empty text or upstream errors", async () => {
  expect(speechChunks("word ".repeat(1000)).every(chunk=>chunk.length<=500)).toBe(true);
  expect(()=>readPage("hi")).toThrow("No text found");
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,json:async()=>({error:"Speech unavailable"})}));
  await expect(speakText("Hello","en")).rejects.toThrow("Speech unavailable"); expect(isPageSpeaking()).toBe(false);
});
