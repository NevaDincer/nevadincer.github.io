---
layout: post
title: "How machines learned to read"
---

## Before anything could "read"

The earliest device in this story didn't read at all (I mean not in the sense we mean now). In 1913 a physicist named [Edmund Fournier d'Albe](https://mallonbacka.com/blog/2023/03/optophone/) built something called the Optophone for blind readers. It used selenium, an element whose electrical conductivity changes with light, to sense whether a spot on a page was dark ink or white paper. A spinning disc chopped a beam of light into pulses, a lens split that beam into seven points across the line of text, and each point's flicker was turned into a musical tone. Different letters produced different chords.

A blind user, Mary Jameson, learned to read those chords the way you'd learn a language. She started at about one word a minute in 1918, and by 1920 she was reading around [twenty-five words a minute](https://doi.org/10.1038/105295a0), according to d'Albe's own paper in Nature. 

But the machine itself never knew what letter it was looking at. It converted light into sound, one point at a time, and left the actual recognition to a trained human ear. The question was whether a machine could turn print into something a person's other senses could interpret not read per se in 1913.

## The first machine that decided for itself

That changed in 1929, when an Austrian engineer named [Gustav Tauschek](https://history-computer.com/inventions/optical-character-recognition/) patented what he called a Reading Machine. This is generally counted as the first real OCR device because for the first time, the machine made the call.

The mechanism was mechanical in the most literal sense. A disc with letter shaped holes cut into it, one hole per character, spun in front of a photocell. The character to be read sat in front of the same photocell. As the disc turned, each hole passed in front of the character in turn, and light could only reach the photocell where the hole and the character's dark strokes didn't overlap. Whichever hole let the most light through was declared the match, and a printing drum rotated to that letter and stamped it out.

![The patent drawing of Tauschek's Reading Machine](https://history-computer.com/wp-content/uploads/2022/02/image-2.webp) _The patent drawing of Tauschek's Reading Machine. (History-Computer)_

It barely worked because the whole thing was a physical overlap test, so anything that shifted the shape even slightly (a smudge, a slightly different size, or maybe a worn typewriter key) could throw off the match. The machine compared silhouettes and nothing else.

## Fonts built for machines, not for people

A few decades later because of that fragility engineers stopped trying to make machines read ordinary print and started designing fonts that machines could read reliably. This part surprised me when I first learned it. I'd assumed OCR eventually got good enough to handle any font but instead people built fonts around the machine's limits.

2 problems kept showing up. Ordinary printed fonts vary a lot between typefaces and even between two copies of the same typeface, and that variation was enough to break a rigid template match. And some characters look dangerously alike to a simple overlap test even though a person never confuses them in context like capital O and the digit 0, lowercase l and capital I and the digit 1, capital S and the digit 5. A human reading a phone number knows which is which because of context. A photocell comparing silhouettes doesn't have context so it doesn't know.

So in 1968, American Type Founders released [OCR-A](https://fonts.adobe.com/fonts/ocr-a), a typeface designed from the ground up so that every character's outline was as different from every other character's as geometry allows, with stroke widths held consistent and characters set on a fixed grid.

Banks had already been running similarly rigid fonts through check-sorting machines since the 1950s, under a system called [magnetic ink character recognition](https://tedium.co/2017/03/22/ocr-typography-optical-character-recognition-history/). OCR-A just applied the same logic to optical scanning instead of magnetic ink. 

![OCR-A font specimen](https://static.tedium.co/2017/03/0323_ocra2.jpg) _The OCR-A specimen. (Tedium)_

The same year, the typographer Adrian Frutiger designed OCR-B for Monotype. He was brought in by the European Computer Manufacturers' Association specifically because OCR-A is a little strange to a human eye (blocky and mechanical, althought that was the point but it was also hard on a human eye) and by his own account the hardest part of the job was keeping an 8 and a B from being read as the same shape. OCR-B eventually became the ISO standard, while OCR-A stayed the American one. It's the one font used for the human-readable numbers printed under a barcode, and it still appears on passports today.

![OCR-B font specimen](https://static.tedium.co/2017/03/0323_ocrb.jpg) _An OCR-B specimen. (Identifont, via Tedium)_

## Reading letters instead of matching shapes

The next real jump came from Ray Kurzweil in 1974, and it's the point where OCR stopped needing a font built just for it. Kurzweil's system was the first that could read ordinary printed text in more or less any font, something people started calling [omni-font recognition](https://en.wikipedia.org/wiki/Timeline_of_optical_character_recognition), a term that stuck because for the first time a single system covered practically any typeface without being retrained for each one.

The shift was conceptual. Instead of asking "does this shape overlap with my stored template of the letter A," [the system asked](https://www.youtube.com/watch?v=ZNrteLp_SvY) "does this shape have the structural properties an A is supposed to have." An A has a closed triangular gap and two legs, no matter what font it's printed in. Extracting properties like that meant the system was comparing structure rather than silhouette, and structure survives a font change in a way a silhouette doesn't. That's the same basic idea that shows up again decades later in deep learning, just done by hand instead of learned from data.

## Letting the machine be unsure

Through the 1980s, most systems were still deterministic. A guess was either right or wrong, full stop. The 1990s brought statistical models into the picture, particularly [Hidden Markov Models and support vector machines](https://arxiv.org/pdf/1412.4183). HMMs in particular were borrowed almost directly from speech recognition, where the same math was already well developed, and the switch mattered because a system could now assign a probability to each candidate answer instead of committing to a single verdict.

HMMs mattered most for [handwriting](https://arxiv.org/pdf/1412.4183). Small models built for individual characters were chained together into a model for an entire word, and recognizing a word meant finding whichever word-model made the observed pen strokes most probable, not matching anything against a fixed template. That mattered a lo where letters in cursive script blend into each other and there's often no clean boundary between one character and the next. An HMM doesn't try to isolate a single letter. It treats the whole stroke as a sequence of states, the path the pen took, and at each point along that path it asks which letter is most likely being formed. It never needs a hard segmentation to work. Pushing uncertainty into the model itself so not every decision has to be binary, turns out to be used in how modern neural networks output their answers too.

## Text stopped living on scanned pages

Everything up to this point assumed text on a flat, evenly lit, high-contrast page, a scanned document. That assumption broke once everyone started carrying a camera in their pocket. Text now showed up on a street sign photographed at an angle, on a product label under uneven light, partly hidden behind a tree branch. Finding where the text even was became its own hard problem.

A handful of techniques took this on, each based on a different physical property of what makes text look like text. Edge detection flagged regions with dense, structured edges, which text tends to have, but so does foliage and fabric, so it produced a lot of false positives on its own. Connected component analysis binarized the image and grouped adjacent dark pixels into blobs, on the reasoning that each letter usually forms its own blob, then filtered those blobs by size and shape. MSER looked at how a region's shape held up as you swept the binarization threshold across a range of values, since text tends to keep a stable shape against its background while noise and texture don't.

My favorite of the four is the Stroke Width Transform, because the underlying observation is so specific to text and nothing else. A letter's stroke, the actual ink, keeps a roughly constant thickness across its whole shape. An O's ring is the same thickness all the way around. So the method fires a ray from every edge pixel straight across to the opposite edge and measures how long that ray is. Across a letter, those measurements come out consistent. That consistency check is enough to separate text-shaped regions without ever knowing what a letter is supposed to look like.

## The year everything got replaced

In 2012 a convolutional neural network called AlexNet won the ImageNet competition by a wide enough margin, [15.3 percent error against 26.2 percent for the runner-up](https://www.pinecone.io/learn/series/image-search/imagenet/), that it reset the field of computer vision almost overnight. OCR researchers noticed this fast, every one of those hand-built rules, stroke width consistency, connected component filtering, was a human's best guess at what distinguishes text from everything else. A CNN shown thousands of labeled examples could learn a better version of that distinction on its own, without anyone writing the rule down.

Between 2014 and 2017, detectors like [EAST and CTPN](https://blog.advance.ai/blog/history-and-the-future-deep-learning-based-ocr) replaced the hand-engineered detection stage entirely. CTPN pairs a CNN backbone with a bidirectional LSTM to pick out long runs of text, and EAST predicts text regions directly from a fully convolutional network without a separate proposal step. Between them, the detector no longer relied on stroke widths or edge thresholds. It was a model trained on enough examples to generalize the pattern on its own.

Recognition changed shape too. The old approach cut a line of text into individual characters and recognized each one, which fell apart on cursive or tightly kerned fonts. The architecture that replaced it, generally called [CRNN](https://blog.advance.ai/blog/history-and-the-future-deep-learning-based-ocr), runs a CNN across the whole line to pull out a strip of visual features, then feeds that strip into a recurrent network, usually an LSTM, that reads left to right and outputs a character guess at every position. The clever part is a training method called CTC, which lets the network learn to produce the right final word without ever being told which exact pixels correspond to which exact letter. The network never has to solve the segmentation problem, because CTC makes it unnecessary.

## One piece of software that lived through the whole shift

If you want a single, concrete example of this whole arc happening in one place, I suggest you to look at [Tesseract](https://en.wikipedia.org/wiki/Timeline_of_optical_character_recognition). It started at Hewlett-Packard Labs in Bristol, UK and Greeley, Colorado, developed between 1985 and 1994, went open source in 2005 through a release with the University of Nevada, Las Vegas, and was developed by Google from 2006 until around 2017. Version 4, released in 2018, replaced its old pattern-matching engine with one built on LSTM networks, the same recurrent architecture behind CRNN-style recognition. So the same piece of software went from rule-based matching to a neural sequence model over the course of about thirty years, which is roughly the same arc this whole post has been tracing.

## Where all the training data came from

Deep learning needs enormous amounts of labeled data, and getting that data for real-world text turned out to need some creative solutions. Google's Street View cars, while driving around photographing entire cities, ended up capturing millions of house numbers on doors and buildings. That collection became the [SVHN dataset](http://ufldl.stanford.edu/housenumbers/), built at Stanford from more than 600,000 labeled digit images, with workers on Amazon Mechanical Turk doing the actual transcribing. It gave researchers a large, genuinely messy set of real-world digits to train on, cropped at different angles, in different lighting, against different backgrounds.

Another solution came from [Luis von Ahn's reCAPTCHA](https://invention.si.edu/invention-stories/human-computation-pioneer-luis-von-ahn), launched in 2007. The distorted words you had to type to prove you weren't a bot were **deliberately** words that OCR software had already failed to read while scanning old books and newspapers. Every person who solved a CAPTCHA was, without realizing it, doing a tiny piece of manual transcription for a digitization project. Von Ahn's [first target for reCAPTCHA was the New York Times archive](https://www.newsweek.com/recaptcha-aka-those-infernal-squiggly-words-almost-done-digitizing-new-york-times-archive-210160), which stretches back to 1851 and runs past 13 million articles, all of it searchable today. Google bought reCAPTCHA in 2009 and pointed it at Google Books next. Millions of words got transcribed this way, for free, as a side effect of a security check.

## What this history leaves out

Nearly everything above assumes printed Latin text (also one character at a time, left to right). Handwriting, especially cursive, is still measurably harder than print, enough that it gets its own name in the literature(which is intelligent character recognition). Chinese and Japanese text has no spaces between words and thousands of possible characters, which changes both detection and recognition in ways the methods above don't directly handle. Arabic runs right to left and characters change shape depending on their position in a word. 

**A reminder**: most of what gets written about OCR, this post included, assumes a Latin alphabet without saying so.

## Where things stand now

The newest development doesn't really treat detection and recognition as two separate steps anymore. Multimodal models like [GPT-4V and Gemini](https://blog.roboflow.com/gpt-4-vision/) can be handed an image directly and asked what text it contains, and they answer without running a distinct detection stage first. Reading text is now just one of the things a general-purpose vision model happens to be able to do. There's no dedicated pipeline built only for that one purpose anymore.

## Which finally brings me back to my phone

I began this whole research because I've taken a flyer on my phone and it automatically knew where the text and thanks to it rather than typing out a phone number I copied it.

Apple's Vision framework, the thing behind Live Text, is built around an API called [VNRecognizeTextRequest](https://developer.apple.com/documentation/vision/recognizing-text-in-images). It runs entirely on the device. Nothing about the photo or the text in it gets sent anywhere, which is possible mainly because the iPhone has a dedicated Neural Engine, a chip built specifically to run this kind of inference fast enough for real time. There are two modes: a fast, lighter one used for the live camera preview, and a slower, more accurate one used once you actually go to extract text. Language-based correction is a toggle in the API, and it's essentially the same idea as the language model post-processing step from decades ago, just run locally now instead of looked up in a dictionary.

One thing developers have pointed out is that Apple doesn't fully expose how Live Text figures out paragraph structure and reading order, the part that makes a photographed page of text come out grouped the way you'd actually read it. Some of that logic seems to stay private to Apple's own apps, which means the layout-grouping problem, deciding what counts as one paragraph versus another, still isn't fully solved even in a system this polished.

I think it isn't perfect. Decorative fonts, low contrast, stylized handwriting, and cluttered natural scenes still trip up even the best systems available today. But going from a blind reader learning to hear the shape of letters to a chip in my pocket reading a flyer in under a second is must be a wild jump for a hundred years of work. Even thought here's still more to figure out.

---

## Sources

- [The Optophone, Matthew Hallonbacka](https://mallonbacka.com/blog/2023/03/optophone/)
- [On a Type-Reading Optophone, Fournier d'Albe, Nature, 1914](https://doi.org/10.1038/105295a0)
- [Optical Character Recognition (OCR) Explained, History-Computer](https://history-computer.com/inventions/optical-character-recognition/)
- [The History of Optical Character Recognition Fonts, Tedium](https://tedium.co/2017/03/22/ocr-typography-optical-character-recognition-history/)
- [OCR-A specimen, Adobe Fonts](https://fonts.adobe.com/fonts/ocr-a)
- [Timeline of optical character recognition, Wikipedia](https://en.wikipedia.org/wiki/Timeline_of_optical_character_recognition)
- [From object detection to text detection and recognition, Wang et al., WIREs Computational Statistics](https://wires.onlinelibrary.wiley.com/doi/abs/10.1002/wics.1547)
- [History and the future: Deep-learning-based OCR](https://blog.advance.ai/blog/history-and-the-future-deep-learning-based-ocr)
- [A survey of modern optical character recognition techniques](https://arxiv.org/pdf/1412.4183)
- [AlexNet and ImageNet: The Birth of Deep Learning, Pinecone](https://www.pinecone.io/learn/series/image-search/imagenet/)
- [Street View House Numbers (SVHN) Dataset, Stanford](http://ufldl.stanford.edu/housenumbers/)
- [GPT-4 with Vision: Complete Guide and Evaluation, Roboflow](https://blog.roboflow.com/gpt-4-vision/)
- [Human Computation Pioneer Luis von Ahn, Smithsonian](https://invention.si.edu/invention-stories/human-computation-pioneer-luis-von-ahn)
- [reCAPTCHA almost done digitizing the New York Times archive, Newsweek](https://www.newsweek.com/recaptcha-aka-those-infernal-squiggly-words-almost-done-digitizing-new-york-times-archive-210160)
- [Recognizing Text in Images, Apple Developer Documentation](https://developer.apple.com/documentation/vision/recognizing-text-in-images)
- [Optical Character Recognition (OCR), Computerphile](https://www.youtube.com/watch?v=ZNrteLp_SvY)
- [How Does Optical Character Recognition (OCR) Work?](https://www.youtube.com/watch?v=jO-1rztr4O0)
