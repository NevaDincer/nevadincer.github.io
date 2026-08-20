---
layout: default
title: ""
---

<div class="intro-hero">
  <div class="intro-text">
    <h1>Hi, I'm Neva.</h1>

    <p>I study Computer Engineering at Bilkent University, and I'm currently interested in computer vision, LLM security, and how these ideas apply to software engineering. I like problems where a human and a machine see the same thing differently, like a maze that looks obvious to your eye but needs a completely different representation before a machine can solve it, and the real work is adapting your point of view to the machine's.</p>

    <p>Outside of that, I write for Gazete Bilkent and recently became the editor of the Culture &amp; Arts section. I'm working toward a master's next, most likely in computer vision or LLM related research.</p>
  </div>

  <img class="intro-photo" src="{{ '/assets/portrait.jpg' | relative_url }}" alt="Neva Dinçer">
</div>

<p>
  <a href="https://github.com/NevaDincer">GitHub</a> ·
  <a href="https://linkedin.com/in/nevadincer">LinkedIn</a> ·
  <a href="mailto:nevadincer@gmail.com">Email</a>
  - feel free to reach out :)
</p>

<div class="contact">
  {% include motif.html curve="say-hi" %}
  <h2>Say hi</h2>
  <p>If you have a question about me or my work, a collaboration idea, (or just want to say hi) send a message:</p>

  <!-- form action: connected to a Formspree endpoint -->
<form action="https://formspree.io/f/xyegjgog" method="POST">
    <input type="text" name="name" placeholder="Name" required>
    <input type="email" name="email" placeholder="Email" required>
    <textarea name="message" placeholder="Message" required></textarea>
    <button type="submit">Send</button>
  </form>
</div>
