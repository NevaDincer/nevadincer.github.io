---
layout: default
title: FAQ
permalink: /faq/
---

{% include motif.html curve="faq" %}
<h2>FAQ</h2>

<div class="entry">
  <p class="entry-title">What are you currently working on?</p>
  <ul class="extra-list">
    {% for item in site.data.experience.items %}
    {% if item.in_progress %}
    <li>{{ item.title }}</li>
    {% endif %}
    {% endfor %}
  </ul>
</div>

<div class="entry">
  <p class="entry-title">Can I look at your CV?</p>
  <p class="entry-body">Yes, <a href="{{ '/assets/cv.pdf' | relative_url }}">here it is</a>.</p>
</div>

<div class="entry">
  <p class="entry-title">What languages do you speak / work in?</p>
  <ul class="extra-list">
    <li>Turkish is my native language.</li>
    <li>I have professional working proficiency in English.</li>
    <li>I recently started learning German, I just passed A1 level.</li>
  </ul>
</div>

<div class="entry">
  <p class="entry-title">What are the tools you can use?</p>
  <ul class="extra-list">
    <li><strong>Languages:</strong> C++, Python, Java, MIPS Assembly, SystemVerilog</li>
    <li><strong>Tools:</strong> OpenCV, ROS 2, LibGDX, Git, Docker, Proteus Design Suite</li>
  </ul>
</div>
