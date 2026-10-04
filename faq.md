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
  <p class="entry-body">Yes, <a href="{{ '/assets/Neva_Dincer_CV.pdf' | relative_url }}" target="_blank" rel="noopener">here it is</a>.</p>
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
  <p class="entry-title">What do you work with?</p>
  <ul class="extra-list">
    <li><strong>Programming:</strong> Python, Java, C++</li>
    <li><strong>Tools & frameworks:</strong> Git, Docker, ROS 2, Webots, ArduPilot, MAVLink, QGroundControl, DSPy, OpenCV</li>
  </ul>
</div>
