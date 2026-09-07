---
layout: default
title: Experience
permalink: /experience/
---

{% include motif.html %}
<h2>Experience</h2>

{% for item in site.data.experience.items %}
<div class="entry">
  <div class="entry-header">
    <span class="entry-title">{{ item.title }}</span>
    <span class="entry-date">{{ item.date }}</span>
  </div>
  <div>
    <span class="tag">{{ item.tag }}</span>{% if item.in_progress %}<span class="tag">in-progress</span>{% endif %}
  </div>
  <p class="entry-body">{{ item.body }}</p>
  {% if item.blog_slug != "" %}
  <p class="entry-link"><a href="{{ '/blog/' | append: item.blog_slug | append: '/' | relative_url }}">get to know better</a></p>
  {% endif %}
</div>
{% endfor %}

<div class="extra-box">
  <p>also involved in</p>
  <ul class="extra-list">
    {% for line in site.data.experience.extras %}
    <li>{{ line }}</li>
    {% endfor %}
  </ul>
</div>
